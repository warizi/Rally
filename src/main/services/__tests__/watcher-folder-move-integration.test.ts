/**
 * applyEvents 통합: 실제 fs 위에서 외부 폴더 이동 시 subtree 재귀 스캔 동작 검증.
 *
 * macOS FSEvents 등 일부 watcher 는 외부 폴더가 한꺼번에 이동돼 들어올 때 최상위
 * 폴더의 create 이벤트만 emit 하고 내부 파일/서브폴더 이벤트는 생략한다. event-processor
 * 의 scanFolderSubtree 가 그 경우에도 누락 없이 DB 동기화하는지 — 실제 fs 와
 * 실제 fs-utils 스캐너로 검증.
 *
 * 단위 테스트(workspace-watcher.test.ts) 는 readDirRecursiveAsync / readFilesAsync
 * 를 mock 으로 대체하므로 실제 fs 경로를 타지 않는다. 이 파일이 그 경로를 커버한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { eq } from 'drizzle-orm'

import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { applyEvents } from '../workspace-watcher/event-processor'
import { folderRepository } from '../../repositories/folder'
import { noteRepository } from '../../repositories/note'
import { csvFileRepository } from '../../repositories/csv-file'
import { pdfFileRepository } from '../../repositories/pdf-file'
import { imageFileRepository } from '../../repositories/image-file'

// 다른 watcher 테스트가 fs / @parcel/watcher 를 vi.mock 으로 가로채는 것과 달리,
// 이 통합 테스트는 실제 fs 를 그대로 사용한다. (vi.mock 은 파일 단위라 격리됨)

vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/tmp') },
  BrowserWindow: { getAllWindows: vi.fn().mockReturnValue([]) }
}))

const WS_ID = 'ws-watcher-int'
let wsDir: string

function makeEvent(
  type: 'create' | 'delete',
  absPath: string
): {
  type: 'create' | 'delete'
  path: string
} {
  return { type, path: absPath }
}

beforeEach(() => {
  // workspace tmpdir
  wsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-watcher-int-'))
  testDb
    .insert(schema.workspaces)
    .values({
      id: WS_ID,
      name: 'Watcher Integration',
      path: wsDir,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .onConflictDoNothing()
    .run()
})

afterEach(() => {
  if (wsDir && fs.existsSync(wsDir)) fs.rmSync(wsDir, { recursive: true, force: true })
  // 테스트 격리: DB row cleanup
  testDb.delete(schema.notes).where(eq(schema.notes.workspaceId, WS_ID)).run()
  testDb.delete(schema.csvFiles).where(eq(schema.csvFiles.workspaceId, WS_ID)).run()
  testDb.delete(schema.pdfFiles).where(eq(schema.pdfFiles.workspaceId, WS_ID)).run()
  testDb.delete(schema.imageFiles).where(eq(schema.imageFiles.workspaceId, WS_ID)).run()
  testDb.delete(schema.folders).where(eq(schema.folders.workspaceId, WS_ID)).run()
  testDb.delete(schema.workspaces).where(eq(schema.workspaces.id, WS_ID)).run()
})

describe('event-processor 통합 — 외부 폴더 이동 (real fs)', () => {
  it('이동된 폴더만 create 이벤트로 들어와도 내부 파일/서브폴더가 DB 에 보완 등록된다', async () => {
    // 외부 폴더 이동을 모방: workspace 안에 mybox 폴더와 내부 콘텐츠를 직접 생성
    const myboxAbs = path.join(wsDir, 'mybox')
    fs.mkdirSync(myboxAbs)
    fs.mkdirSync(path.join(myboxAbs, 'sub'))
    fs.writeFileSync(path.join(myboxAbs, 'note.md'), '# Note')
    fs.writeFileSync(path.join(myboxAbs, 'doc.pdf'), Buffer.from([0x25, 0x50, 0x44, 0x46]))
    fs.writeFileSync(path.join(myboxAbs, 'sub', 'data.csv'), 'a,b\n1,2')
    fs.writeFileSync(path.join(myboxAbs, 'sub', 'pic.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    // FSEvents 시뮬레이션: 최상위 폴더 create 이벤트만 emit
    await applyEvents(WS_ID, wsDir, [makeEvent('create', myboxAbs)])

    // 폴더 record
    expect(folderRepository.findByRelativePath(WS_ID, 'mybox')).toBeDefined()
    expect(folderRepository.findByRelativePath(WS_ID, 'mybox/sub')).toBeDefined()

    // 4 타입 파일 record 모두 등록
    expect(noteRepository.findByRelativePath(WS_ID, 'mybox/note.md')).toBeDefined()
    expect(pdfFileRepository.findByRelativePath(WS_ID, 'mybox/doc.pdf')).toBeDefined()
    expect(csvFileRepository.findByRelativePath(WS_ID, 'mybox/sub/data.csv')).toBeDefined()
    expect(imageFileRepository.findByRelativePath(WS_ID, 'mybox/sub/pic.png')).toBeDefined()

    // 서브폴더 내 파일은 서브폴더 record 와 folderId 매칭
    const subFolder = folderRepository.findByRelativePath(WS_ID, 'mybox/sub')
    const csv = csvFileRepository.findByRelativePath(WS_ID, 'mybox/sub/data.csv')
    expect(csv?.folderId).toBe(subFolder?.id)
  })

  it('빈 폴더 create — 회귀 없음, 폴더 record 만 생성', async () => {
    const emptyAbs = path.join(wsDir, 'empty')
    fs.mkdirSync(emptyAbs)

    await applyEvents(WS_ID, wsDir, [makeEvent('create', emptyAbs)])

    expect(folderRepository.findByRelativePath(WS_ID, 'empty')).toBeDefined()
    expect(noteRepository.findByWorkspaceId(WS_ID)).toHaveLength(0)
  })

  it('동일 폴더 create 이벤트 두 번 — 중복 record 없음', async () => {
    const myboxAbs = path.join(wsDir, 'mybox')
    fs.mkdirSync(myboxAbs)
    fs.writeFileSync(path.join(myboxAbs, 'note.md'), '# Note')

    await applyEvents(WS_ID, wsDir, [makeEvent('create', myboxAbs)])
    await applyEvents(WS_ID, wsDir, [makeEvent('create', myboxAbs)])

    const folders = folderRepository
      .findByWorkspaceId(WS_ID)
      .filter((f) => f.relativePath === 'mybox')
    expect(folders).toHaveLength(1)
    const notes = noteRepository
      .findByWorkspaceId(WS_ID)
      .filter((n) => n.relativePath === 'mybox/note.md')
    expect(notes).toHaveLength(1)
  })

  it('image .images/ 폴더는 skipFilter 로 제외된다', async () => {
    const myboxAbs = path.join(wsDir, 'mybox')
    fs.mkdirSync(myboxAbs)
    fs.mkdirSync(path.join(myboxAbs, '.images'))
    fs.writeFileSync(
      path.join(myboxAbs, '.images', 'embedded.png'),
      Buffer.from([0x89, 0x50, 0x4e, 0x47])
    )
    fs.writeFileSync(path.join(myboxAbs, 'visible.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    await applyEvents(WS_ID, wsDir, [makeEvent('create', myboxAbs)])

    // 노트 본문 임베드용 .images/ 는 image record 로 잡으면 안 됨
    expect(
      imageFileRepository.findByRelativePath(WS_ID, 'mybox/.images/embedded.png')
    ).toBeUndefined()
    expect(imageFileRepository.findByRelativePath(WS_ID, 'mybox/visible.png')).toBeDefined()
  })
})

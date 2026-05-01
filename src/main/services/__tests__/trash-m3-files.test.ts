import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { trashService } from '../trash'
import { noteRepository } from '../../repositories/note'
import { csvFileRepository } from '../../repositories/csv-file'
import { pdfFileRepository } from '../../repositories/pdf-file'
import { imageFileRepository } from '../../repositories/image-file'

// 단일 파일 도메인 (note/csv/pdf/image) 통합 테스트.
// 실제 fs 사용 — 임시 디렉토리에 워크스페이스 + .trash 모두 만들어 검증.

let WS_DIR: string
let USERDATA_DIR: string
const WS = 'ws-trash-m3'

beforeEach(() => {
  // tmpdir 마다 새 작업 폴더 — 테스트끼리 격리
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-trash-m3-'))
  WS_DIR = path.join(base, 'workspace')
  USERDATA_DIR = path.join(base, 'userdata')
  fs.mkdirSync(WS_DIR, { recursive: true })
  fs.mkdirSync(USERDATA_DIR, { recursive: true })

  // trashService.getTrashRoot의 fallback이 process.cwd 사용 — chdir로 강제
  process.chdir(base)
  // .rally-test-userdata 심볼릭 링크 대신 명시 경로 사용
  // getTrashRoot는 fallback `<cwd>/.rally-test-userdata` 반환

  testDb.delete(schema.entityLinks).run()
  testDb.delete(schema.reminders).run()
  testDb.delete(schema.imageFiles).run()
  testDb.delete(schema.pdfFiles).run()
  testDb.delete(schema.csvFiles).run()
  testDb.delete(schema.notes).run()
  testDb.delete(schema.folders).run()
  testDb.delete(schema.trashBatches).run()
  testDb.delete(schema.workspaces).run()
  testDb
    .insert(schema.workspaces)
    .values({
      id: WS,
      name: 'T',
      path: WS_DIR,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
})

afterEach(() => {
  // 정리 — best effort
  try {
    fs.rmSync(path.dirname(WS_DIR), { recursive: true, force: true })
  } catch {
    // ignore
  }
})

function seedNote(id: string, relPath: string, content = `# ${id}`): void {
  const abs = path.join(WS_DIR, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf-8')
  testDb
    .insert(schema.notes)
    .values({
      id,
      workspaceId: WS,
      relativePath: relPath,
      title: id,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function seedCsv(id: string, relPath: string): void {
  const abs = path.join(WS_DIR, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, 'a,b\n1,2', 'utf-8')
  testDb
    .insert(schema.csvFiles)
    .values({
      id,
      workspaceId: WS,
      relativePath: relPath,
      title: id,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function seedPdf(id: string, relPath: string): void {
  const abs = path.join(WS_DIR, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, Buffer.from([0x25, 0x50, 0x44, 0x46])) // %PDF
  testDb
    .insert(schema.pdfFiles)
    .values({
      id,
      workspaceId: WS,
      relativePath: relPath,
      title: id,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function seedImage(id: string, relPath: string): void {
  const abs = path.join(WS_DIR, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, Buffer.from([0x89, 0x50, 0x4e, 0x47])) // PNG header
  testDb
    .insert(schema.imageFiles)
    .values({
      id,
      workspaceId: WS,
      relativePath: relPath,
      title: id,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

describe('파일 도메인 softRemove → fs 이동', () => {
  it('note: 파일이 워크스페이스 → trash 디렉토리로 이동', () => {
    seedNote('n-1', 'doc.md', 'content')
    const absSrc = path.join(WS_DIR, 'doc.md')
    expect(fs.existsSync(absSrc)).toBe(true)

    trashService.softRemove(WS, 'note', 'n-1')
    expect(fs.existsSync(absSrc)).toBe(false)

    // noteRepository로 trash row 확인
    expect(noteRepository.findInTrashByWorkspaceId(WS).map((n) => n.id)).toEqual(['n-1'])
  })

  it('csv/pdf/image도 동일 패턴으로 이동', () => {
    seedCsv('c-1', 'data.csv')
    seedPdf('p-1', 'doc.pdf')
    seedImage('i-1', 'photo.png')
    trashService.softRemove(WS, 'csv', 'c-1')
    trashService.softRemove(WS, 'pdf', 'p-1')
    trashService.softRemove(WS, 'image', 'i-1')

    expect(fs.existsSync(path.join(WS_DIR, 'data.csv'))).toBe(false)
    expect(fs.existsSync(path.join(WS_DIR, 'doc.pdf'))).toBe(false)
    expect(fs.existsSync(path.join(WS_DIR, 'photo.png'))).toBe(false)

    expect(csvFileRepository.findInTrashByWorkspaceId(WS)).toHaveLength(1)
    expect(pdfFileRepository.findInTrashByWorkspaceId(WS)).toHaveLength(1)
    expect(imageFileRepository.findInTrashByWorkspaceId(WS)).toHaveLength(1)
  })

  it('하위 폴더 안 파일도 정상 이동 (디렉토리 구조 유지)', () => {
    seedNote('n-deep', 'projects/2026/plan.md', 'content')
    expect(fs.existsSync(path.join(WS_DIR, 'projects/2026/plan.md'))).toBe(true)
    trashService.softRemove(WS, 'note', 'n-deep')
    expect(fs.existsSync(path.join(WS_DIR, 'projects/2026/plan.md'))).toBe(false)
  })

  it('원본 파일이 이미 외부에서 삭제됐어도 DB는 휴지통으로 (skip move)', () => {
    seedNote('n-gone', 'gone.md')
    fs.unlinkSync(path.join(WS_DIR, 'gone.md'))
    expect(() => trashService.softRemove(WS, 'note', 'n-gone')).not.toThrow()
    expect(noteRepository.findInTrashByWorkspaceId(WS).map((n) => n.id)).toEqual(['n-gone'])
  })
})

describe('파일 도메인 restore', () => {
  it('note 복구 — fs 파일 원래 위치로 + 활성 list에 다시 보임', () => {
    seedNote('n-1', 'doc.md', 'restore-me')
    const batchId = trashService.softRemove(WS, 'note', 'n-1')

    trashService.restore(batchId)
    expect(noteRepository.findById('n-1')).toBeDefined()
    expect(fs.existsSync(path.join(WS_DIR, 'doc.md'))).toBe(true)
    expect(fs.readFileSync(path.join(WS_DIR, 'doc.md'), 'utf-8')).toBe('restore-me')
  })

  it('복구 시 같은 위치에 다른 파일 있으면 자동 rename', () => {
    seedNote('n-1', 'doc.md', 'original')
    const batchId = trashService.softRemove(WS, 'note', 'n-1')
    // 사용자가 다른 파일을 같은 이름으로 만든 상황
    fs.writeFileSync(path.join(WS_DIR, 'doc.md'), 'different', 'utf-8')

    trashService.restore(batchId)
    // 원래 파일은 그대로
    expect(fs.readFileSync(path.join(WS_DIR, 'doc.md'), 'utf-8')).toBe('different')
    // 복구된 파일은 (1) 등 suffix
    const restored = noteRepository.findById('n-1')!
    expect(restored.relativePath).not.toBe('doc.md')
    expect(restored.relativePath).toMatch(/doc.*\.md$/)
    expect(fs.existsSync(path.join(WS_DIR, restored.relativePath))).toBe(true)
  })
})

describe('파일 도메인 purge', () => {
  it('purge — DB row + fs trash 디렉토리 모두 제거', () => {
    seedNote('n-1', 'doc.md')
    const batchId = trashService.softRemove(WS, 'note', 'n-1')
    const batch = testDb.select().from(schema.trashBatches).all()[0]
    const trashFsPath = batch.fsTrashPath!
    expect(fs.existsSync(trashFsPath)).toBe(true)

    trashService.purge(batchId)
    expect(noteRepository.findByIdIncludingDeleted('n-1')).toBeUndefined()
    expect(fs.existsSync(trashFsPath)).toBe(false)
  })
})

describe('M3-A4: service.remove 통합', () => {
  it('noteService.remove() → trash + fs 이동', async () => {
    const { noteService } = await import('../note')
    seedNote('n-soft', 'soft.md', 'soft-content')
    noteService.remove(WS, 'n-soft')
    expect(fs.existsSync(path.join(WS_DIR, 'soft.md'))).toBe(false)
    expect(noteRepository.findById('n-soft')).toBeUndefined()
    expect(noteRepository.findInTrashByWorkspaceId(WS)).toHaveLength(1)
  })

  it('noteService.remove({ permanent: true }) → 즉시 영구 삭제', async () => {
    const { noteService } = await import('../note')
    seedNote('n-hard', 'hard.md')
    noteService.remove(WS, 'n-hard', { permanent: true })
    expect(noteRepository.findByIdIncludingDeleted('n-hard')).toBeUndefined()
    expect(fs.existsSync(path.join(WS_DIR, 'hard.md'))).toBe(false)
  })
})

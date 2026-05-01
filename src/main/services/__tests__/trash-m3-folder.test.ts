import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { trashService } from '../trash'
import { noteRepository } from '../../repositories/note'
import { csvFileRepository } from '../../repositories/csv-file'
import { folderRepository } from '../../repositories/folder'

let WS_DIR: string
const WS = 'ws-trash-m3-folder'

beforeEach(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-trash-m3-folder-'))
  WS_DIR = path.join(base, 'workspace')
  fs.mkdirSync(WS_DIR, { recursive: true })
  process.chdir(base)

  testDb.delete(schema.entityLinks).run()
  testDb.delete(schema.imageFiles).run()
  testDb.delete(schema.pdfFiles).run()
  testDb.delete(schema.csvFiles).run()
  testDb.delete(schema.notes).run()
  testDb.delete(schema.folders).run()
  testDb.delete(schema.trashBatches).run()
  testDb.delete(schema.workspaces).run()
  testDb
    .insert(schema.workspaces)
    .values({ id: WS, name: 'T', path: WS_DIR, createdAt: new Date(), updatedAt: new Date() })
    .run()
})

afterEach(() => {
  try {
    fs.rmSync(path.dirname(WS_DIR), { recursive: true, force: true })
  } catch {
    // ignore
  }
})

function seedFolder(id: string, relPath: string): void {
  fs.mkdirSync(path.join(WS_DIR, relPath), { recursive: true })
  testDb
    .insert(schema.folders)
    .values({
      id,
      workspaceId: WS,
      relativePath: relPath,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function seedNote(id: string, relPath: string, folderId: string | null = null): void {
  const abs = path.join(WS_DIR, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, `# ${id}`, 'utf-8')
  testDb
    .insert(schema.notes)
    .values({
      id,
      workspaceId: WS,
      folderId,
      relativePath: relPath,
      title: id,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function seedCsv(id: string, relPath: string, folderId: string | null = null): void {
  const abs = path.join(WS_DIR, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, 'a,b\n1,2', 'utf-8')
  testDb
    .insert(schema.csvFiles)
    .values({
      id,
      workspaceId: WS,
      folderId,
      relativePath: relPath,
      title: id,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

describe('folder cascade — softRemove', () => {
  it('빈 폴더 — 폴더 자체만 휴지통', () => {
    seedFolder('f-1', 'docs')
    expect(fs.existsSync(path.join(WS_DIR, 'docs'))).toBe(true)
    trashService.softRemove(WS, 'folder', 'f-1')
    expect(fs.existsSync(path.join(WS_DIR, 'docs'))).toBe(false)
    expect(folderRepository.findById('f-1')).toBeUndefined()
    expect(folderRepository.findInTrashByWorkspaceId(WS).map((f) => f.id)).toEqual(['f-1'])
  })

  it('폴더 + 안의 파일들 같은 batch로 묶임', () => {
    seedFolder('f-root', 'projects')
    seedNote('n-1', 'projects/plan.md', 'f-root')
    seedCsv('c-1', 'projects/data.csv', 'f-root')

    const batchId = trashService.softRemove(WS, 'folder', 'f-root')
    expect(folderRepository.findByTrashBatchId(batchId).map((f) => f.id)).toEqual(['f-root'])
    expect(noteRepository.findByTrashBatchId(batchId).map((n) => n.id)).toEqual(['n-1'])
    expect(csvFileRepository.findByTrashBatchId(batchId).map((c) => c.id)).toEqual(['c-1'])

    // fs는 폴더 통째 이동
    expect(fs.existsSync(path.join(WS_DIR, 'projects'))).toBe(false)
  })

  it('중첩 폴더 — 모든 후손이 같은 batch', () => {
    seedFolder('root', 'workspace')
    seedFolder('mid', 'workspace/2026')
    seedFolder('leaf', 'workspace/2026/q1')
    seedNote('n-1', 'workspace/intro.md', 'root')
    seedNote('n-2', 'workspace/2026/plan.md', 'mid')
    seedNote('n-3', 'workspace/2026/q1/sprint.md', 'leaf')

    const batchId = trashService.softRemove(WS, 'folder', 'root')

    expect(
      folderRepository
        .findByTrashBatchId(batchId)
        .map((f) => f.id)
        .sort()
    ).toEqual(['leaf', 'mid', 'root'])
    expect(
      noteRepository
        .findByTrashBatchId(batchId)
        .map((n) => n.id)
        .sort()
    ).toEqual(['n-1', 'n-2', 'n-3'])

    // 모든 활성 list에서 사라짐
    expect(folderRepository.findByWorkspaceId(WS)).toHaveLength(0)
    expect(noteRepository.findByWorkspaceId(WS)).toHaveLength(0)

    // fs: 폴더 root만 이동, 자식은 그 안에 따라감
    expect(fs.existsSync(path.join(WS_DIR, 'workspace'))).toBe(false)
  })
})

describe('folder cascade — restore', () => {
  it('충돌 없을 때 원래 위치로 복구', () => {
    seedFolder('f-1', 'docs')
    seedNote('n-1', 'docs/note.md', 'f-1')
    const batchId = trashService.softRemove(WS, 'folder', 'f-1')

    trashService.restore(batchId)
    expect(folderRepository.findById('f-1')).toBeDefined()
    expect(noteRepository.findById('n-1')).toBeDefined()
    expect(fs.existsSync(path.join(WS_DIR, 'docs'))).toBe(true)
    expect(fs.existsSync(path.join(WS_DIR, 'docs/note.md'))).toBe(true)
  })

  it('충돌 시 root folder rename + 자식 row의 relativePath prefix 갱신', () => {
    seedFolder('f-1', 'docs')
    seedNote('n-1', 'docs/note.md', 'f-1')
    const batchId = trashService.softRemove(WS, 'folder', 'f-1')

    // 사용자가 같은 이름으로 새 폴더 생성한 상황
    fs.mkdirSync(path.join(WS_DIR, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(WS_DIR, 'docs/other.md'), 'different', 'utf-8')

    trashService.restore(batchId)

    // 원본 폴더는 유지
    expect(fs.existsSync(path.join(WS_DIR, 'docs/other.md'))).toBe(true)

    // 복구된 폴더는 새 이름
    const restoredFolder = folderRepository.findById('f-1')!
    expect(restoredFolder.relativePath).not.toBe('docs')
    expect(restoredFolder.relativePath).toMatch(/^docs/)

    // 자식 노트의 relativePath도 prefix가 갱신됨
    const restoredNote = noteRepository.findById('n-1')!
    expect(restoredNote.relativePath.startsWith(`${restoredFolder.relativePath}/`)).toBe(true)
    expect(fs.existsSync(path.join(WS_DIR, restoredNote.relativePath))).toBe(true)
  })
})

describe('folder cascade — purge', () => {
  it('purge — DB row + fs trash 디렉토리 모두 제거', () => {
    seedFolder('f-1', 'docs')
    seedNote('n-1', 'docs/note.md', 'f-1')
    const batchId = trashService.softRemove(WS, 'folder', 'f-1')
    const batch = testDb.select().from(schema.trashBatches).all()[0]
    expect(fs.existsSync(batch.fsTrashPath!)).toBe(true)

    trashService.purge(batchId)
    expect(folderRepository.findByIdIncludingDeleted('f-1')).toBeUndefined()
    expect(noteRepository.findByIdIncludingDeleted('n-1')).toBeUndefined()
    expect(fs.existsSync(batch.fsTrashPath!)).toBe(false)
  })
})

describe('M3-B3: folderService.remove 통합', () => {
  it('folderService.remove() → 휴지통', async () => {
    const { folderService } = await import('../folder')
    seedFolder('f-soft', 'soft-folder')
    seedNote('n-1', 'soft-folder/inside.md', 'f-soft')

    folderService.remove(WS, 'f-soft')
    expect(folderRepository.findById('f-soft')).toBeUndefined()
    expect(folderRepository.findInTrashByWorkspaceId(WS)).toHaveLength(1)
    expect(fs.existsSync(path.join(WS_DIR, 'soft-folder'))).toBe(false)
  })

  it('folderService.remove({ permanent: true }) → 즉시 영구 삭제', async () => {
    const { folderService } = await import('../folder')
    seedFolder('f-hard', 'hard-folder')
    seedNote('n-1', 'hard-folder/inside.md', 'f-hard')

    folderService.remove(WS, 'f-hard', { permanent: true })
    expect(folderRepository.findByIdIncludingDeleted('f-hard')).toBeUndefined()
    expect(fs.existsSync(path.join(WS_DIR, 'hard-folder'))).toBe(false)
  })
})

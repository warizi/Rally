import { describe, expect, it, vi, beforeEach } from 'vitest'
import { workspaceItemsService } from '../workspace-items'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { noteService } from '../note'
import { csvFileService } from '../csv-file'
import { canvasService } from '../canvas'
import { todoService } from '../todo'
import { NotFoundError, ValidationError } from '../../lib/errors'

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/folder', () => ({
  folderRepository: { findByWorkspaceId: vi.fn() }
}))

vi.mock('../note', () => ({
  noteService: { readByWorkspaceFromDb: vi.fn() }
}))

vi.mock('../csv-file', () => ({
  csvFileService: { readByWorkspaceFromDb: vi.fn() }
}))

vi.mock('../canvas', () => ({
  canvasService: { findByWorkspace: vi.fn() }
}))

vi.mock('../todo', () => ({
  todoService: { countByWorkspace: vi.fn() }
}))

const mockWorkspace = {
  id: 'ws-1',
  name: 'Test',
  path: '/ws',
  createdAt: new Date(),
  updatedAt: new Date()
}

const baseDate = new Date('2026-01-01T00:00:00Z')
const newerDate = new Date('2026-04-01T00:00:00Z')

const mockFolders = [
  { id: 'f-root', workspaceId: 'ws-1', relativePath: 'root', order: 0, color: null, createdAt: baseDate, updatedAt: baseDate, deletedAt: null, trashBatchId: null },
  { id: 'f-child', workspaceId: 'ws-1', relativePath: 'root/child', order: 0, color: null, createdAt: baseDate, updatedAt: baseDate, deletedAt: null, trashBatchId: null },
  { id: 'f-grand', workspaceId: 'ws-1', relativePath: 'root/child/grand', order: 0, color: null, createdAt: baseDate, updatedAt: newerDate, deletedAt: null, trashBatchId: null },
  { id: 'f-other', workspaceId: 'ws-1', relativePath: 'other', order: 1, color: null, createdAt: baseDate, updatedAt: baseDate, deletedAt: null, trashBatchId: null }
]

const mockNotes = [
  { id: 'n-1', title: 'note1', relativePath: 'root/note1.md', description: '', preview: 'p1', folderId: 'f-root', order: 0, createdAt: baseDate, updatedAt: baseDate },
  { id: 'n-2', title: 'note2', relativePath: 'root/child/note2.md', description: '', preview: 'p2', folderId: 'f-child', order: 0, createdAt: baseDate, updatedAt: newerDate },
  { id: 'n-3', title: 'note3', relativePath: 'root/child/grand/note3.md', description: '', preview: 'p3', folderId: 'f-grand', order: 0, createdAt: baseDate, updatedAt: baseDate },
  { id: 'n-4', title: 'note4', relativePath: 'other/note4.md', description: '', preview: 'p4', folderId: 'f-other', order: 0, createdAt: baseDate, updatedAt: baseDate }
]

const mockTables = [
  { id: 't-1', title: 'tbl1', relativePath: 'root/t1.csv', description: 'd1', preview: 'tp1', columnWidths: null, folderId: 'f-root', order: 0, createdAt: baseDate, updatedAt: baseDate },
  { id: 't-2', title: 'tbl2', relativePath: 'root/child/t2.csv', description: 'd2', preview: 'tp2', columnWidths: null, folderId: 'f-child', order: 0, createdAt: baseDate, updatedAt: newerDate }
]

const mockCanvases = [
  { id: 'c-1', workspaceId: 'ws-1', title: 'canvas1', description: 'cd1', viewportX: 0, viewportY: 0, viewportZoom: 1, createdAt: baseDate, updatedAt: baseDate },
  { id: 'c-2', workspaceId: 'ws-1', title: 'canvas2', description: 'cd2', viewportX: 0, viewportY: 0, viewportZoom: 1, createdAt: baseDate, updatedAt: newerDate }
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(mockWorkspace)
  vi.mocked(folderRepository.findByWorkspaceId).mockReturnValue(mockFolders)
  vi.mocked(noteService.readByWorkspaceFromDb).mockReturnValue(mockNotes)
  vi.mocked(csvFileService.readByWorkspaceFromDb).mockReturnValue(mockTables)
  vi.mocked(canvasService.findByWorkspace).mockReturnValue(mockCanvases)
  vi.mocked(todoService.countByWorkspace).mockReturnValue({ active: 3, completed: 1, total: 4 })
})

describe('workspaceItemsService.list', () => {
  describe('기본 동작', () => {
    it('옵션 없이 호출하면 모든 종류를 풀 필드로 반환', () => {
      const r = workspaceItemsService.list('ws-1')
      expect(r.workspace).toEqual({ id: 'ws-1', name: 'Test', path: '/ws' })
      expect(r.folders).toHaveLength(4)
      expect(r.notes).toHaveLength(4)
      expect(r.tables).toHaveLength(2)
      expect(r.canvases).toHaveLength(2)
      expect(r.todos).toEqual({ active: 3, completed: 1, total: 4 })
      expect(r.notes[0]).toMatchObject({ id: 'n-1', title: 'note1', preview: 'p1', relativePath: 'root/note1.md', folderPath: 'root' })
    })

    it('워크스페이스가 없으면 NotFoundError', () => {
      vi.mocked(workspaceRepository.findById).mockReturnValueOnce(undefined)
      expect(() => workspaceItemsService.list('ws-x')).toThrow(NotFoundError)
    })

    it('meta는 옵션 + 카운트 + hasMore를 포함', () => {
      const r = workspaceItemsService.list('ws-1')
      expect(r.meta.summary).toBe(false)
      expect(r.meta.folderId).toBe(null)
      expect(r.meta.recursive).toBe(false)
      expect(r.meta.types).toBe(null)
      expect(r.meta.counts).toEqual({ folders: 4, notes: 4, tables: 2, canvases: 2 })
      expect(r.meta.hasMore).toEqual({ folders: false, notes: false, tables: false, canvases: false })
    })
  })

  describe('summary 모드', () => {
    it('summary=true면 preview/relativePath/folderPath/description 제거', () => {
      const r = workspaceItemsService.list('ws-1', { summary: true })
      const note = r.notes[0]
      expect(note).toEqual({ id: 'n-1', title: 'note1', folderId: 'f-root', updatedAt: baseDate.toISOString() })
      expect(note).not.toHaveProperty('preview')
      expect(note).not.toHaveProperty('relativePath')
      expect(note).not.toHaveProperty('folderPath')
      const table = r.tables[0]
      expect(table).toEqual({ id: 't-1', title: 'tbl1', folderId: 'f-root', updatedAt: baseDate.toISOString() })
      expect(table).not.toHaveProperty('description')
      expect(table).not.toHaveProperty('preview')
      const canvas = r.canvases[0]
      expect(canvas).toEqual({ id: 'c-1', title: 'canvas1', createdAt: baseDate.toISOString(), updatedAt: baseDate.toISOString() })
      expect(canvas).not.toHaveProperty('description')
    })
  })

  describe('types 필터', () => {
    it('types=[folder]면 folders만 채움, 나머지 빈 배열', () => {
      const r = workspaceItemsService.list('ws-1', { types: ['folder'] })
      expect(r.folders.length).toBeGreaterThan(0)
      expect(r.notes).toHaveLength(0)
      expect(r.tables).toHaveLength(0)
      expect(r.canvases).toHaveLength(0)
      expect(r.meta.counts).toEqual({ folders: 4, notes: 0, tables: 0, canvases: 0 })
    })

    it('types=[note,canvas]면 note/canvas만 포함', () => {
      const r = workspaceItemsService.list('ws-1', { types: ['note', 'canvas'] })
      expect(r.folders).toHaveLength(0)
      expect(r.notes.length).toBeGreaterThan(0)
      expect(r.tables).toHaveLength(0)
      expect(r.canvases.length).toBeGreaterThan(0)
    })

    it('빈 types 배열은 ValidationError', () => {
      expect(() => workspaceItemsService.list('ws-1', { types: [] })).toThrow(ValidationError)
    })
  })

  describe('folderId 스코프', () => {
    it('folderId 미지정이면 모든 폴더/노트/테이블/캔버스 포함', () => {
      const r = workspaceItemsService.list('ws-1')
      expect(r.folders).toHaveLength(4)
      expect(r.notes).toHaveLength(4)
      expect(r.canvases).toHaveLength(2)
    })

    it('folderId만 지정 (recursive=false)는 직속 자식만', () => {
      const r = workspaceItemsService.list('ws-1', { folderId: 'f-root' })
      // 직속 자식 폴더: f-child만 (f-grand는 손주, f-other는 무관)
      expect(r.folders.map((f) => f.id).sort()).toEqual(['f-child'])
      // 직속 자식 노트: f-root에 속한 n-1만 (n-2/n-3는 하위 폴더 소속)
      expect(r.notes.map((n) => n.id).sort()).toEqual(['n-1'])
      // tables도 마찬가지
      expect(r.tables.map((t) => t.id).sort()).toEqual(['t-1'])
      // canvas는 폴더 스코프 시 빈 결과
      expect(r.canvases).toHaveLength(0)
    })

    it('folderId + recursive=true면 모든 후손 포함', () => {
      const r = workspaceItemsService.list('ws-1', { folderId: 'f-root', recursive: true })
      // root의 후손 폴더: f-child, f-grand
      expect(r.folders.map((f) => f.id).sort()).toEqual(['f-child', 'f-grand'])
      // root + 모든 후손에 속한 노트: n-1, n-2, n-3 (n-4는 other)
      expect(r.notes.map((n) => n.id).sort()).toEqual(['n-1', 'n-2', 'n-3'])
      expect(r.tables.map((t) => t.id).sort()).toEqual(['t-1', 't-2'])
      expect(r.canvases).toHaveLength(0)
    })

    it('존재하지 않는 folderId는 NotFoundError', () => {
      expect(() => workspaceItemsService.list('ws-1', { folderId: 'f-missing' })).toThrow(NotFoundError)
    })
  })

  describe('updatedAfter 필터', () => {
    it('updatedAfter 이후 항목만 포함', () => {
      const cutoff = new Date('2026-03-01T00:00:00Z')
      const r = workspaceItemsService.list('ws-1', { updatedAfter: cutoff })
      // newerDate(2026-04-01) 이후 항목만
      expect(r.folders.map((f) => f.id)).toEqual(['f-grand'])
      expect(r.notes.map((n) => n.id)).toEqual(['n-2'])
      expect(r.tables.map((t) => t.id)).toEqual(['t-2'])
      expect(r.canvases.map((c) => c.id)).toEqual(['c-2'])
    })
  })

  describe('limit / offset', () => {
    it('limit으로 종류별 자르기 + hasMore=true', () => {
      const r = workspaceItemsService.list('ws-1', { limit: 2 })
      expect(r.folders).toHaveLength(2)
      expect(r.notes).toHaveLength(2)
      expect(r.meta.counts.notes).toBe(4)
      expect(r.meta.hasMore.notes).toBe(true)
      expect(r.meta.hasMore.folders).toBe(true)
    })

    it('offset으로 페이지네이션', () => {
      const page1 = workspaceItemsService.list('ws-1', { limit: 2, offset: 0 })
      const page2 = workspaceItemsService.list('ws-1', { limit: 2, offset: 2 })
      const allIds = [...page1.notes.map((n) => n.id), ...page2.notes.map((n) => n.id)]
      expect(new Set(allIds).size).toBe(4)
      expect(page2.meta.hasMore.notes).toBe(false)
    })

    it('limit 범위 밖이면 ValidationError', () => {
      expect(() => workspaceItemsService.list('ws-1', { limit: 0 })).toThrow(ValidationError)
      expect(() => workspaceItemsService.list('ws-1', { limit: 1001 })).toThrow(ValidationError)
    })

    it('offset이 음수면 ValidationError', () => {
      expect(() => workspaceItemsService.list('ws-1', { offset: -1 })).toThrow(ValidationError)
    })
  })
})

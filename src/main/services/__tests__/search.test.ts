import { describe, expect, it, vi, beforeEach } from 'vitest'
import { searchService } from '../search'
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
  noteService: { search: vi.fn() }
}))

vi.mock('../csv-file', () => ({
  csvFileService: { search: vi.fn() }
}))

vi.mock('../canvas', () => ({
  canvasService: { search: vi.fn() }
}))

vi.mock('../todo', () => ({
  todoService: { search: vi.fn() }
}))

const mockWorkspace = {
  id: 'ws-1',
  name: 'Test',
  path: '/ws',
  createdAt: new Date(),
  updatedAt: new Date()
}

const folderRows = [
  {
    id: 'f-1',
    workspaceId: 'ws-1',
    relativePath: 'projects',
    order: 0,
    color: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    trashBatchId: null
  }
]

const noteHit = {
  id: 'n-1',
  title: 'My Plan',
  relativePath: 'projects/plan.md',
  folderId: 'fld-1',
  updatedAt: new Date('2026-04-20T00:00:00Z'),
  preview: 'we will plan the migration carefully here',
  matchType: 'title' as const
}

const tableHit = {
  id: 't-1',
  title: 'Plan Spreadsheet',
  relativePath: 'projects/plan.csv',
  preview: 'col1,col2\nplan,row',
  folderId: 'f-1',
  matchType: 'title' as const,
  updatedAt: new Date('2026-04-15T00:00:00Z')
}

const canvasHit = {
  id: 'c-1',
  title: 'Plan Diagram',
  description: 'visual plan',
  matchType: 'title' as const,
  updatedAt: new Date('2026-04-20T00:00:00Z')
}

const todoHit = {
  id: 'td-1',
  title: 'Plan release',
  description: 'plan release pipeline',
  matchType: 'title' as const,
  updatedAt: new Date('2026-04-25T00:00:00Z'),
  isDone: false
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(mockWorkspace)
  vi.mocked(folderRepository.findByWorkspaceId).mockReturnValue(folderRows)
  vi.mocked(noteService.search).mockResolvedValue([noteHit])
  vi.mocked(csvFileService.search).mockReturnValue([tableHit])
  vi.mocked(canvasService.search).mockReturnValue([canvasHit])
  vi.mocked(todoService.search).mockReturnValue([todoHit])
})

describe('searchService.search', () => {
  describe('기본 동작 + types 분기', () => {
    it('기본 types는 note만 (search_notes 호환)', async () => {
      const r = await searchService.search('ws-1', 'plan')
      expect(noteService.search).toHaveBeenCalledOnce()
      expect(csvFileService.search).not.toHaveBeenCalled()
      expect(canvasService.search).not.toHaveBeenCalled()
      expect(todoService.search).not.toHaveBeenCalled()
      expect(r.results).toHaveLength(1)
      expect(r.results[0].type).toBe('note')
      expect(r.meta.types).toEqual(['note'])
    })

    it('types에 모든 도메인 지정 시 4개 도메인 모두 호출', async () => {
      const r = await searchService.search('ws-1', 'plan', {
        types: ['note', 'table', 'canvas', 'todo']
      })
      expect(noteService.search).toHaveBeenCalledOnce()
      expect(csvFileService.search).toHaveBeenCalledOnce()
      expect(canvasService.search).toHaveBeenCalledOnce()
      expect(todoService.search).toHaveBeenCalledOnce()
      expect(r.results.map((h) => h.type).sort()).toEqual(['canvas', 'note', 'table', 'todo'])
      expect(r.meta.perTypeCounts).toEqual({ note: 1, table: 1, canvas: 1, todo: 1 })
    })
  })

  describe('빈 쿼리 + 검증', () => {
    it('빈 쿼리는 빈 결과 + 도메인 호출 없음', async () => {
      const r = await searchService.search('ws-1', '   ')
      expect(noteService.search).not.toHaveBeenCalled()
      expect(r.results).toEqual([])
      expect(r.total).toBe(0)
      expect(r.hasMore).toBe(false)
    })

    it('워크스페이스가 없으면 NotFoundError', async () => {
      vi.mocked(workspaceRepository.findById).mockReturnValueOnce(undefined)
      await expect(searchService.search('ws-x', 'plan')).rejects.toThrow(NotFoundError)
    })

    it('잘못된 type은 ValidationError', async () => {
      await expect(
        searchService.search('ws-1', 'plan', { types: ['invalid' as never] })
      ).rejects.toThrow(ValidationError)
    })

    it('빈 types 배열은 ValidationError', async () => {
      await expect(searchService.search('ws-1', 'plan', { types: [] })).rejects.toThrow(
        ValidationError
      )
    })

    it('limit 범위 밖이면 ValidationError', async () => {
      await expect(searchService.search('ws-1', 'plan', { limit: 0 })).rejects.toThrow(
        ValidationError
      )
      await expect(searchService.search('ws-1', 'plan', { limit: 101 })).rejects.toThrow(
        ValidationError
      )
    })

    it('offset이 음수면 ValidationError', async () => {
      await expect(searchService.search('ws-1', 'plan', { offset: -1 })).rejects.toThrow(
        ValidationError
      )
    })
  })

  describe('정렬: title 매칭 우선', () => {
    it('title vs description 매칭이 섞이면 title이 먼저 온다', async () => {
      vi.mocked(noteService.search).mockResolvedValue([
        { ...noteHit, matchType: 'content' }
      ])
      vi.mocked(canvasService.search).mockReturnValue([{ ...canvasHit, matchType: 'description' }])
      vi.mocked(todoService.search).mockReturnValue([{ ...todoHit, matchType: 'title' }])

      const r = await searchService.search('ws-1', 'plan', {
        types: ['note', 'canvas', 'todo']
      })
      expect(r.results[0].matchType).toBe('title')
      expect(r.results[0].type).toBe('todo')
    })

    it('title 매칭끼리는 updatedAt desc', async () => {
      // 모두 title 매칭, updatedAt이 다른 두 항목
      vi.mocked(canvasService.search).mockReturnValue([
        {
          ...canvasHit,
          id: 'c-old',
          matchType: 'title',
          updatedAt: new Date('2026-01-01T00:00:00Z')
        }
      ])
      vi.mocked(todoService.search).mockReturnValue([
        {
          ...todoHit,
          id: 'td-new',
          matchType: 'title',
          updatedAt: new Date('2026-04-25T00:00:00Z')
        }
      ])
      const r = await searchService.search('ws-1', 'plan', { types: ['canvas', 'todo'] })
      expect(r.results[0].id).toBe('td-new')
    })
  })

  describe('페이지네이션', () => {
    it('limit + offset slicing + hasMore/nextOffset', async () => {
      // 4개 hit 만들기
      vi.mocked(noteService.search).mockResolvedValue([])
      vi.mocked(csvFileService.search).mockReturnValue([
        { ...tableHit, id: 't-1' },
        { ...tableHit, id: 't-2' },
        { ...tableHit, id: 't-3' },
        { ...tableHit, id: 't-4' }
      ])
      vi.mocked(canvasService.search).mockReturnValue([])
      vi.mocked(todoService.search).mockReturnValue([])

      const r = await searchService.search('ws-1', 'plan', {
        types: ['table'],
        limit: 2,
        offset: 0
      })
      expect(r.results).toHaveLength(2)
      expect(r.total).toBe(4)
      expect(r.hasMore).toBe(true)
      expect(r.nextOffset).toBe(2)

      const page2 = await searchService.search('ws-1', 'plan', {
        types: ['table'],
        limit: 2,
        offset: 2
      })
      expect(page2.results).toHaveLength(2)
      expect(page2.hasMore).toBe(false)
      expect(page2.nextOffset).toBe(4)
    })
  })

  describe('highlight 모드', () => {
    it('highlight=false면 excerpt 없음', async () => {
      const r = await searchService.search('ws-1', 'plan', { types: ['table'] })
      expect(r.results[0].excerpt).toBeUndefined()
    })

    it('highlight=true면 매칭 주변 50자 발췌', async () => {
      vi.mocked(csvFileService.search).mockReturnValue([
        {
          ...tableHit,
          id: 't-1',
          // preview는 충분히 긴 텍스트
          preview: 'a'.repeat(60) + 'plan' + 'b'.repeat(60),
          matchType: 'content'
        }
      ])
      const r = await searchService.search('ws-1', 'plan', {
        types: ['table'],
        highlight: true
      })
      const hit = r.results[0]
      expect(hit.excerpt).toBeDefined()
      expect(hit.excerpt).toContain('plan')
      // 양쪽 잘림 표시
      expect(hit.excerpt!.startsWith('…')).toBe(true)
      expect(hit.excerpt!.endsWith('…')).toBe(true)
    })

    it('preview가 비면 title에서 excerpt 추출', async () => {
      vi.mocked(canvasService.search).mockReturnValue([
        {
          ...canvasHit,
          id: 'c-1',
          title: 'Plan Diagram',
          description: '',
          matchType: 'title'
        }
      ])
      const r = await searchService.search('ws-1', 'plan', {
        types: ['canvas'],
        highlight: true
      })
      expect(r.results[0].excerpt).toContain('Plan Diagram')
    })
  })

  describe('folderPath 리졸브', () => {
    it('table은 folderId 기반으로 folderPath 채움', async () => {
      const r = await searchService.search('ws-1', 'plan', { types: ['table'] })
      expect(r.results[0].folderPath).toBe('projects')
      expect(r.results[0].folderId).toBe('f-1')
    })

    it('note는 relativePath에서 dirname 추출', async () => {
      const r = await searchService.search('ws-1', 'plan', { types: ['note'] })
      expect(r.results[0].folderPath).toBe('projects')
    })

    it('루트 노트는 folderPath null', async () => {
      vi.mocked(noteService.search).mockResolvedValue([
        { ...noteHit, relativePath: 'plan.md', folderId: null }
      ])
      const r = await searchService.search('ws-1', 'plan', { types: ['note'] })
      expect(r.results[0].folderPath).toBe(null)
    })
  })
})

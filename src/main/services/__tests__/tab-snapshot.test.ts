import { describe, expect, it, vi, beforeEach } from 'vitest'
import { tabSnapshotService } from '../tab-snapshot'
import { tabSnapshotRepository } from '../../repositories/tab-snapshot'
import { NotFoundError, ValidationError } from '../../lib/errors'

vi.mock('../../repositories/tab-snapshot', () => ({
  tabSnapshotRepository: {
    findByWorkspaceId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('nanoid', () => ({
  nanoid: () => 'mocked-id'
}))

const mockSnapshot = {
  id: 'mocked-id',
  name: 'My Snapshot',
  description: null,
  workspaceId: 'ws-1',
  tabsJson: '{"tab-1":{}}',
  panesJson: '{"pane-1":{}}',
  layoutJson: '{"type":"pane"}',
  createdAt: new Date(),
  updatedAt: new Date()
}

const validCreateInput = {
  name: 'My Snapshot',
  description: undefined,
  workspaceId: 'ws-1',
  tabsJson: '{"tab-1":{}}',
  panesJson: '{"pane-1":{}}',
  layoutJson: '{"type":"pane"}'
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('tabSnapshotService', () => {
  describe('getByWorkspaceId', () => {
    it('스냅샷 목록을 반환한다', () => {
      vi.mocked(tabSnapshotRepository.findByWorkspaceId).mockReturnValue([mockSnapshot])
      const result = tabSnapshotService.getByWorkspaceId('ws-1')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('My Snapshot')
      expect(tabSnapshotRepository.findByWorkspaceId).toHaveBeenCalledWith('ws-1')
    })
  })

  describe('create', () => {
    it('유효한 입력으로 스냅샷을 생성한다', () => {
      vi.mocked(tabSnapshotRepository.create).mockReturnValue(mockSnapshot)
      const result = tabSnapshotService.create(validCreateInput)
      expect(result.name).toBe('My Snapshot')
    })

    it('nanoid로 생성된 id가 repository.create에 전달된다', () => {
      vi.mocked(tabSnapshotRepository.create).mockReturnValue(mockSnapshot)
      tabSnapshotService.create(validCreateInput)
      expect(tabSnapshotRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'mocked-id' })
      )
    })

    it('name이 trim()되어 저장된다', () => {
      vi.mocked(tabSnapshotRepository.create).mockReturnValue(mockSnapshot)
      tabSnapshotService.create({ ...validCreateInput, name: '  My Snapshot  ' })
      expect(tabSnapshotRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Snapshot' })
      )
    })

    it('description이 없으면 null로 저장된다', () => {
      vi.mocked(tabSnapshotRepository.create).mockReturnValue(mockSnapshot)
      tabSnapshotService.create({ ...validCreateInput, description: undefined })
      expect(tabSnapshotRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: null })
      )
    })

    it('description에 문자열 값이 있으면 trim되어 저장된다', () => {
      vi.mocked(tabSnapshotRepository.create).mockReturnValue(mockSnapshot)
      tabSnapshotService.create({ ...validCreateInput, description: '  memo  ' })
      expect(tabSnapshotRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'memo' })
      )
    })

    it('createdAt과 updatedAt이 Date로 설정된다', () => {
      vi.mocked(tabSnapshotRepository.create).mockReturnValue(mockSnapshot)
      tabSnapshotService.create(validCreateInput)
      expect(tabSnapshotRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        })
      )
    })

    it('빈 name이면 ValidationError를 던진다', () => {
      expect(() => tabSnapshotService.create({ ...validCreateInput, name: '' })).toThrow(
        ValidationError
      )
    })

    it('공백만 있는 name이면 ValidationError를 던진다', () => {
      expect(() => tabSnapshotService.create({ ...validCreateInput, name: '   ' })).toThrow(
        ValidationError
      )
    })

    it('tabsJson이 없으면 ValidationError를 던진다', () => {
      expect(() => tabSnapshotService.create({ ...validCreateInput, tabsJson: '' })).toThrow(
        ValidationError
      )
    })

    it('panesJson이 없으면 ValidationError를 던진다', () => {
      expect(() => tabSnapshotService.create({ ...validCreateInput, panesJson: '' })).toThrow(
        ValidationError
      )
    })

    it('layoutJson이 없으면 ValidationError를 던진다', () => {
      expect(() => tabSnapshotService.create({ ...validCreateInput, layoutJson: '' })).toThrow(
        ValidationError
      )
    })
  })

  describe('update', () => {
    it('존재하는 스냅샷을 수정한다', () => {
      const updated = { ...mockSnapshot, name: 'Updated' }
      vi.mocked(tabSnapshotRepository.findById).mockReturnValue(mockSnapshot)
      vi.mocked(tabSnapshotRepository.update).mockReturnValue(updated)
      const result = tabSnapshotService.update('mocked-id', { name: 'Updated' })
      expect(result?.name).toBe('Updated')
    })

    it('updatedAt이 새로운 Date로 업데이트된다', () => {
      vi.mocked(tabSnapshotRepository.findById).mockReturnValue(mockSnapshot)
      vi.mocked(tabSnapshotRepository.update).mockReturnValue(mockSnapshot)
      tabSnapshotService.update('mocked-id', { name: 'Updated' })
      expect(tabSnapshotRepository.update).toHaveBeenCalledWith(
        'mocked-id',
        expect.objectContaining({ updatedAt: expect.any(Date) })
      )
    })

    it('존재하지 않는 id면 NotFoundError를 던진다', () => {
      vi.mocked(tabSnapshotRepository.findById).mockReturnValue(undefined)
      expect(() => tabSnapshotService.update('non-existent', { name: 'Updated' })).toThrow(
        NotFoundError
      )
    })

    it('name이 빈 문자열이면 ValidationError를 던진다', () => {
      vi.mocked(tabSnapshotRepository.findById).mockReturnValue(mockSnapshot)
      expect(() => tabSnapshotService.update('mocked-id', { name: '' })).toThrow(ValidationError)
    })

    it('name이 공백만 있으면 ValidationError를 던진다', () => {
      vi.mocked(tabSnapshotRepository.findById).mockReturnValue(mockSnapshot)
      expect(() => tabSnapshotService.update('mocked-id', { name: '   ' })).toThrow(ValidationError)
    })

    it('name이 undefined이면 검증을 건너뛴다 (JSON만 업데이트 가능)', () => {
      const updated = { ...mockSnapshot, tabsJson: '{"tab-new":{}}' }
      vi.mocked(tabSnapshotRepository.findById).mockReturnValue(mockSnapshot)
      vi.mocked(tabSnapshotRepository.update).mockReturnValue(updated)
      expect(() =>
        tabSnapshotService.update('mocked-id', { tabsJson: '{"tab-new":{}}' })
      ).not.toThrow()
    })
  })

  describe('delete', () => {
    it('존재하는 스냅샷을 삭제한다', () => {
      vi.mocked(tabSnapshotRepository.findById).mockReturnValue(mockSnapshot)
      tabSnapshotService.delete('mocked-id')
      expect(tabSnapshotRepository.delete).toHaveBeenCalledWith('mocked-id')
    })

    it('존재하지 않는 id면 NotFoundError를 던진다', () => {
      vi.mocked(tabSnapshotRepository.findById).mockReturnValue(undefined)
      expect(() => tabSnapshotService.delete('non-existent')).toThrow(NotFoundError)
    })
  })
})

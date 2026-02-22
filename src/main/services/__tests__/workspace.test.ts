import { describe, expect, it, vi, beforeEach } from 'vitest'
import { workspaceService } from '../workspace'
import { workspaceRepository } from '../../repositories/workspace'
import { NotFoundError, ValidationError } from '../../lib/errors'

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('nanoid', () => ({
  nanoid: () => 'mocked-id'
}))

const mockWorkspace = {
  id: 'mocked-id',
  name: 'Test Workspace',
  createdAt: new Date(),
  updatedAt: new Date()
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('workspaceService', () => {
  describe('getAll', () => {
    it('전체 워크스페이스를 반환한다', () => {
      vi.mocked(workspaceRepository.findAll).mockReturnValue([mockWorkspace])
      const result = workspaceService.getAll()
      expect(result).toHaveLength(1)
    })
  })

  describe('getById', () => {
    it('존재하는 워크스페이스를 반환한다', () => {
      vi.mocked(workspaceRepository.findById).mockReturnValue(mockWorkspace)
      const result = workspaceService.getById('mocked-id')
      expect(result).toEqual(mockWorkspace)
    })

    it('존재하지 않으면 NotFoundError를 던진다', () => {
      vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
      expect(() => workspaceService.getById('non-existent')).toThrow(NotFoundError)
    })
  })

  describe('create', () => {
    it('워크스페이스를 생성한다', () => {
      vi.mocked(workspaceRepository.create).mockReturnValue(mockWorkspace)
      const result = workspaceService.create('Test Workspace')
      expect(result.name).toBe('Test Workspace')
    })

    it('빈 이름이면 ValidationError를 던진다', () => {
      expect(() => workspaceService.create('')).toThrow(ValidationError)
    })

    it('공백만 있는 이름이면 ValidationError를 던진다', () => {
      expect(() => workspaceService.create('   ')).toThrow(ValidationError)
    })
  })

  describe('update', () => {
    it('워크스페이스를 수정한다', () => {
      vi.mocked(workspaceRepository.findById).mockReturnValue(mockWorkspace)
      vi.mocked(workspaceRepository.update).mockReturnValue({ ...mockWorkspace, name: 'Updated' })
      const result = workspaceService.update('mocked-id', { name: 'Updated' })
      expect(result?.name).toBe('Updated')
    })

    it('존재하지 않으면 NotFoundError를 던진다', () => {
      vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
      expect(() => workspaceService.update('non-existent', { name: 'Updated' })).toThrow(
        NotFoundError
      )
    })

    it('빈 이름으로 수정하면 ValidationError를 던진다', () => {
      vi.mocked(workspaceRepository.findById).mockReturnValue(mockWorkspace)
      expect(() => workspaceService.update('mocked-id', { name: '' })).toThrow(ValidationError)
    })
  })

  describe('delete', () => {
    it('워크스페이스를 삭제한다', () => {
      const other = { ...mockWorkspace, id: 'other-id' }
      vi.mocked(workspaceRepository.findById).mockReturnValue(mockWorkspace)
      vi.mocked(workspaceRepository.findAll).mockReturnValue([mockWorkspace, other])
      expect(() => workspaceService.delete('mocked-id')).not.toThrow()
    })

    it('존재하지 않으면 NotFoundError를 던진다', () => {
      vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
      expect(() => workspaceService.delete('non-existent')).toThrow(NotFoundError)
    })

    it('마지막 워크스페이스면 ValidationError를 던진다', () => {
      vi.mocked(workspaceRepository.findById).mockReturnValue(mockWorkspace)
      vi.mocked(workspaceRepository.findAll).mockReturnValue([mockWorkspace])
      expect(() => workspaceService.delete('mocked-id')).toThrow(ValidationError)
    })
  })
})

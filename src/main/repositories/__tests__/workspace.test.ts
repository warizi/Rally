import { describe, expect, it } from 'vitest'
import { workspaceRepository } from '../workspace'
import { testDb } from '../../__tests__/setup'
import { workspaces } from '../../db/schema'

const mockWorkspace = {
  id: '1',
  name: 'Test Workspace',
  createdAt: new Date(),
  updatedAt: new Date()
}

describe('workspaceRepository', () => {
  describe('findAll', () => {
    it('빈 배열을 반환한다', () => {
      const result = workspaceRepository.findAll()
      expect(result).toEqual([])
    })

    it('전체 워크스페이스를 반환한다', () => {
      testDb.insert(workspaces).values(mockWorkspace).run()
      const result = workspaceRepository.findAll()
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Test Workspace')
    })
  })

  describe('findById', () => {
    it('존재하는 id면 워크스페이스를 반환한다', () => {
      testDb.insert(workspaces).values(mockWorkspace).run()
      const result = workspaceRepository.findById('1')
      expect(result).toBeDefined()
      expect(result?.name).toBe('Test Workspace')
    })

    it('존재하지 않는 id면 undefined를 반환한다', () => {
      const result = workspaceRepository.findById('non-existent')
      expect(result).toBeUndefined()
    })
  })

  describe('create', () => {
    it('워크스페이스를 생성한다', () => {
      const result = workspaceRepository.create(mockWorkspace)
      expect(result.name).toBe('Test Workspace')
      expect(result.id).toBe('1')
    })
  })

  describe('update', () => {
    it('워크스페이스를 수정한다', () => {
      testDb.insert(workspaces).values(mockWorkspace).run()
      const result = workspaceRepository.update('1', { name: 'Updated' })
      expect(result?.name).toBe('Updated')
    })

    it('존재하지 않는 id면 undefined를 반환한다', () => {
      const result = workspaceRepository.update('non-existent', { name: 'Updated' })
      expect(result).toBeUndefined()
    })
  })

  describe('delete', () => {
    it('워크스페이스를 삭제한다', () => {
      testDb.insert(workspaces).values(mockWorkspace).run()
      workspaceRepository.delete('1')
      const result = workspaceRepository.findById('1')
      expect(result).toBeUndefined()
    })
  })
})

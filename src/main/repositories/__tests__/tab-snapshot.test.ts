import { describe, expect, it } from 'vitest'
import { tabSnapshotRepository } from '../tab-snapshot'
import type { TabSnapshot } from '../tab-snapshot'
import { testDb } from '../../__tests__/setup'
import { workspaces, tabSnapshots } from '../../db/schema'

const mockWorkspace = {
  id: 'ws-1',
  name: 'Test Workspace',
  path: '/test/path',
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockSnapshot = {
  id: 'snap-1',
  name: 'My Snapshot',
  description: null,
  workspaceId: 'ws-1',
  tabsJson: '{"tab-1":{}}',
  panesJson: '{"pane-1":{}}',
  layoutJson: '{"type":"pane"}',
  createdAt: new Date(),
  updatedAt: new Date()
}

function seedWorkspace(): void {
  testDb.insert(workspaces).values(mockWorkspace).run()
}

function seedSnapshot(): TabSnapshot {
  seedWorkspace()
  return testDb.insert(tabSnapshots).values(mockSnapshot).returning().get()!
}

describe('tabSnapshotRepository', () => {
  describe('findByWorkspaceId', () => {
    it('데이터가 없으면 빈 배열을 반환한다', () => {
      seedWorkspace()
      const result = tabSnapshotRepository.findByWorkspaceId('ws-1')
      expect(result).toEqual([])
    })

    it('해당 workspaceId의 스냅샷을 반환한다', () => {
      seedSnapshot()
      const result = tabSnapshotRepository.findByWorkspaceId('ws-1')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('My Snapshot')
    })

    it('같은 workspaceId의 스냅샷 여러 개를 모두 반환한다', () => {
      seedWorkspace()
      testDb
        .insert(tabSnapshots)
        .values([
          { ...mockSnapshot, id: 'snap-a', name: 'Snapshot A' },
          { ...mockSnapshot, id: 'snap-b', name: 'Snapshot B' }
        ])
        .run()
      const result = tabSnapshotRepository.findByWorkspaceId('ws-1')
      expect(result).toHaveLength(2)
      expect(result.map((s) => s.name)).toContain('Snapshot A')
      expect(result.map((s) => s.name)).toContain('Snapshot B')
    })

    it('다른 workspaceId의 스냅샷은 포함하지 않는다', () => {
      seedSnapshot()
      const result = tabSnapshotRepository.findByWorkspaceId('ws-other')
      expect(result).toEqual([])
    })
  })

  describe('findById', () => {
    it('존재하는 id면 스냅샷을 반환한다', () => {
      seedSnapshot()
      const result = tabSnapshotRepository.findById('snap-1')
      expect(result).toBeDefined()
      expect(result?.name).toBe('My Snapshot')
    })

    it('존재하지 않는 id면 undefined를 반환한다', () => {
      const result = tabSnapshotRepository.findById('non-existent')
      expect(result).toBeUndefined()
    })
  })

  describe('create', () => {
    it('스냅샷을 생성하고 반환한다', () => {
      seedWorkspace()
      const result = tabSnapshotRepository.create(mockSnapshot)
      expect(result.id).toBe('snap-1')
      expect(result.name).toBe('My Snapshot')
      expect(result.workspaceId).toBe('ws-1')
      expect(result.tabsJson).toBe('{"tab-1":{}}')
      expect(result.panesJson).toBe('{"pane-1":{}}')
      expect(result.layoutJson).toBe('{"type":"pane"}')
    })
  })

  describe('update', () => {
    it('name과 description을 수정한다', () => {
      seedSnapshot()
      const result = tabSnapshotRepository.update('snap-1', {
        name: 'Updated Name',
        description: 'New desc'
      })
      expect(result?.name).toBe('Updated Name')
      expect(result?.description).toBe('New desc')
    })

    it('tabsJson, panesJson, layoutJson을 수정한다 (overwrite)', () => {
      seedSnapshot()
      const result = tabSnapshotRepository.update('snap-1', {
        tabsJson: '{"tab-new":{}}',
        panesJson: '{"pane-new":{}}',
        layoutJson: '{"type":"split"}'
      })
      expect(result?.tabsJson).toBe('{"tab-new":{}}')
      expect(result?.panesJson).toBe('{"pane-new":{}}')
      expect(result?.layoutJson).toBe('{"type":"split"}')
    })

    it('존재하지 않는 id면 undefined를 반환한다', () => {
      const result = tabSnapshotRepository.update('non-existent', { name: 'Updated' })
      expect(result).toBeUndefined()
    })
  })

  describe('delete', () => {
    it('스냅샷을 삭제한다', () => {
      seedSnapshot()
      tabSnapshotRepository.delete('snap-1')
      const result = tabSnapshotRepository.findById('snap-1')
      expect(result).toBeUndefined()
    })

    it('workspace 삭제 시 cascade로 스냅샷도 삭제된다', () => {
      seedSnapshot()
      testDb.delete(workspaces).run()
      const result = tabSnapshotRepository.findById('snap-1')
      expect(result).toBeUndefined()
    })
  })
})

import { describe, expect, it } from 'vitest'
import { TabSession, tabSessionRepository } from '../tab-session'
import { testDb } from '../../__tests__/setup'
import { workspaces, tabSessions } from '../../db/schema'

const mockWorkspace = {
  id: 'workspace-1',
  name: 'Test Workspace',
  path: '/test/path',
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockTabSession = {
  workspaceId: 'workspace-1',
  tabsJson: '{}',
  panesJson: '{}',
  layoutJson: '{}',
  activePaneId: 'pane-1',
  updatedAt: new Date()
}

function seedWorkspace(): void {
  testDb.insert(workspaces).values(mockWorkspace).run()
}

function seedTabSession(): TabSession {
  seedWorkspace()
  return testDb.insert(tabSessions).values(mockTabSession).returning().get()
}

describe('tabSessionRepository', () => {
  describe('findTabSessionByWorkspaceId', () => {
    it('존재하는 workspaceId면 세션을 반환한다', () => {
      seedTabSession()
      const result = tabSessionRepository.findTabSessionByWorkspaceId('workspace-1')
      expect(result).toBeDefined()
      expect(result?.workspaceId).toBe('workspace-1')
    })

    it('존재하지 않는 workspaceId면 undefined를 반환한다', () => {
      const result = tabSessionRepository.findTabSessionByWorkspaceId('non-existent')
      expect(result).toBeUndefined()
    })
  })

  describe('findById', () => {
    it('존재하는 id면 세션을 반환한다', () => {
      const inserted = seedTabSession()
      const result = tabSessionRepository.findById(inserted!.id)
      expect(result).toBeDefined()
      expect(result?.id).toBe(inserted!.id)
    })

    it('존재하지 않는 id면 undefined를 반환한다', () => {
      const result = tabSessionRepository.findById(9999)
      expect(result).toBeUndefined()
    })
  })

  describe('upsertTabSession', () => {
    it('세션이 없으면 생성한다', () => {
      seedWorkspace()
      const result = tabSessionRepository.upsertTabSession(mockTabSession)
      expect(result).toBeDefined()
      expect(result.workspaceId).toBe('workspace-1')
      expect(result.activePaneId).toBe('pane-1')
    })

    it('세션이 있으면 업데이트한다', () => {
      seedTabSession()
      const result = tabSessionRepository.upsertTabSession({
        ...mockTabSession,
        activePaneId: 'pane-2'
      })
      expect(result.activePaneId).toBe('pane-2')
      const all = testDb.select().from(tabSessions).all()
      expect(all).toHaveLength(1)
    })
  })
})

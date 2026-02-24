import { describe, expect, it } from 'vitest'
import { tabSessionRepository } from '../tab-session'
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

function seedWorkspace() {
  testDb.insert(workspaces).values(mockWorkspace).run()
}

function seedTabSession() {
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

  describe('createTabSession', () => {
    it('탭 세션을 생성한다', () => {
      seedWorkspace()
      const result = tabSessionRepository.createTabSession(mockTabSession)
      expect(result).toBeDefined()
      expect(result?.workspaceId).toBe('workspace-1')
      expect(result?.activePaneId).toBe('pane-1')
    })
  })

  describe('updateTabSession', () => {
    it('탭 세션을 수정한다', () => {
      const inserted = seedTabSession()
      const result = tabSessionRepository.updateTabSession({
        ...inserted!,
        activePaneId: 'pane-2',
        updatedAt: new Date()
      })
      expect(result?.activePaneId).toBe('pane-2')
    })

    it('존재하지 않는 workspaceId면 undefined를 반환한다', () => {
      const result = tabSessionRepository.updateTabSession({
        id: 9999,
        workspaceId: 'non-existent',
        tabsJson: '{}',
        panesJson: '{}',
        layoutJson: '{}',
        activePaneId: 'pane-1',
        updatedAt: new Date()
      })
      expect(result).toBeUndefined()
    })
  })
})

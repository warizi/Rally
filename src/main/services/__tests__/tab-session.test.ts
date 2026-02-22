import { describe, expect, it, vi, beforeEach } from 'vitest'
import { tabSessionService } from '../tab-session'
import { tabSessionRepository } from '../../repositories/tab-session'
import { NotFoundError, ValidationError } from '../../lib/errors'

vi.mock('../../repositories/tab-session', () => ({
  tabSessionRepository: {
    findTabSessionByWorkspaceId: vi.fn(),
    findById: vi.fn(),
    createTabSession: vi.fn(),
    updateTabSession: vi.fn()
  }
}))

const mockTabSession = {
  id: 1,
  workspaceId: 'workspace-1',
  tabsJson: '{"tab-1": {}}',
  panesJson: '{"pane-1": {}}',
  layoutJson: '{"type": "pane"}',
  activePaneId: 'pane-1',
  updatedAt: new Date()
}

const validInput = {
  workspaceId: 'workspace-1',
  tabsJson: '{"tab-1": {}}',
  panesJson: '{"pane-1": {}}',
  layoutJson: '{"type": "pane"}',
  activePaneId: 'pane-1'
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('tabSessionService', () => {
  describe('getByWorkspaceId', () => {
    it('존재하는 세션을 반환한다', () => {
      vi.mocked(tabSessionRepository.findTabSessionByWorkspaceId).mockReturnValue(mockTabSession)
      const result = tabSessionService.getByWorkspaceId('workspace-1')
      expect(result).toEqual(mockTabSession)
    })

    it('존재하지 않으면 NotFoundError를 던진다', () => {
      vi.mocked(tabSessionRepository.findTabSessionByWorkspaceId).mockReturnValue(undefined)
      expect(() => tabSessionService.getByWorkspaceId('non-existent')).toThrow(NotFoundError)
    })
  })

  describe('create', () => {
    it('탭 세션을 생성한다', () => {
      vi.mocked(tabSessionRepository.createTabSession).mockReturnValue(mockTabSession)
      const result = tabSessionService.create(validInput)
      expect(result).toEqual(mockTabSession)
      expect(tabSessionRepository.createTabSession).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'workspace-1', activePaneId: 'pane-1' })
      )
    })

    it('tabsJson이 없으면 ValidationError를 던진다', () => {
      expect(() => tabSessionService.create({ ...validInput, tabsJson: '' })).toThrow(
        ValidationError
      )
    })

    it('panesJson이 없으면 ValidationError를 던진다', () => {
      expect(() => tabSessionService.create({ ...validInput, panesJson: '' })).toThrow(
        ValidationError
      )
    })

    it('layoutJson이 없으면 ValidationError를 던진다', () => {
      expect(() => tabSessionService.create({ ...validInput, layoutJson: '' })).toThrow(
        ValidationError
      )
    })

    it('activePaneId가 없으면 ValidationError를 던진다', () => {
      expect(() => tabSessionService.create({ ...validInput, activePaneId: '' })).toThrow(
        ValidationError
      )
    })
  })

  describe('update', () => {
    it('탭 세션을 수정한다', () => {
      const updated = { ...mockTabSession, activePaneId: 'pane-2' }
      vi.mocked(tabSessionRepository.updateTabSession).mockReturnValue(updated)
      const result = tabSessionService.update({ ...mockTabSession, activePaneId: 'pane-2' })
      expect(result?.activePaneId).toBe('pane-2')
      expect(tabSessionRepository.updateTabSession).toHaveBeenCalledWith(
        expect.objectContaining({ activePaneId: 'pane-2' })
      )
    })

    it('tabsJson이 없으면 ValidationError를 던진다', () => {
      expect(() => tabSessionService.update({ ...mockTabSession, tabsJson: '' })).toThrow(
        ValidationError
      )
    })

    it('panesJson이 없으면 ValidationError를 던진다', () => {
      expect(() => tabSessionService.update({ ...mockTabSession, panesJson: '' })).toThrow(
        ValidationError
      )
    })

    it('layoutJson이 없으면 ValidationError를 던진다', () => {
      expect(() => tabSessionService.update({ ...mockTabSession, layoutJson: '' })).toThrow(
        ValidationError
      )
    })

    it('activePaneId가 없으면 ValidationError를 던진다', () => {
      expect(() => tabSessionService.update({ ...mockTabSession, activePaneId: '' })).toThrow(
        ValidationError
      )
    })
  })
})

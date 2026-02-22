import { NotFoundError, ValidationError } from '../lib/errors'
import { TabSession, TabSessionInsert, tabSessionRepository } from '../repositories/tab-session'

export const tabSessionService = {
  getByWorkspaceId(workspaceId: string) {
    const session = tabSessionRepository.findTabSessionByWorkspaceId(workspaceId)
    if (!session) throw new NotFoundError(`TabSession not found: ${workspaceId}`)
    return session
  },

  create(data: Omit<TabSessionInsert, 'updatedAt'>) {
    if (!data.tabsJson || !data.panesJson || !data.layoutJson || !data.activePaneId) {
      throw new ValidationError('Invalid tab session data')
    }
    return tabSessionRepository.createTabSession({
      ...data,
      updatedAt: new Date()
    })
  },

  update(data: Omit<TabSession, 'updatedAt'>) {
    if (!data.tabsJson || !data.panesJson || !data.layoutJson || !data.activePaneId) {
      throw new ValidationError('Invalid tab session data')
    }
    return tabSessionRepository.updateTabSession({
      ...data,
      updatedAt: new Date()
    })
  }
}

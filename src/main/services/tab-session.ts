import { NotFoundError, ValidationError } from '../lib/errors'
import { tabSessionRepository } from '../repositories/tab-session'
import type { TabSession, TabSessionInsert } from '../repositories/tab-session'

export type { TabSession, TabSessionInsert }

export const tabSessionService = {
  getByWorkspaceId(workspaceId: string) {
    const session = tabSessionRepository.findTabSessionByWorkspaceId(workspaceId)
    if (!session) throw new NotFoundError(`TabSession not found: ${workspaceId}`)
    return session
  },

  upsert(data: Omit<TabSessionInsert, 'updatedAt'>) {
    if (!data.tabsJson || !data.panesJson || !data.layoutJson || !data.activePaneId) {
      throw new ValidationError('Invalid tab session data')
    }
    return tabSessionRepository.upsertTabSession({ ...data, updatedAt: new Date() })
  }
}

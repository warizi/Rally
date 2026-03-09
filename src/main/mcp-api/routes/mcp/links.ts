import type { Router } from '../../router'
import { requireBody, resolveActiveWorkspace } from './helpers'
import { entityLinkService } from '../../../services/entity-link'
import type { LinkAction, ManageLinkResult } from './types'

export function registerMcpLinkRoutes(router: Router): void {
  router.addRoute<{ actions: LinkAction[] }>('POST', '/api/mcp/links/batch', (_params, body) => {
    requireBody(body)
    const wsId = resolveActiveWorkspace()
    const { actions } = body as { actions: LinkAction[] }

    const results: ManageLinkResult[] = []

    for (const action of actions) {
      if (action.action === 'link') {
        entityLinkService.link(
          action.sourceType,
          action.sourceId,
          action.targetType,
          action.targetId,
          wsId
        )
        results.push({
          action: 'link',
          sourceType: action.sourceType,
          sourceId: action.sourceId,
          targetType: action.targetType,
          targetId: action.targetId,
          success: true
        })
      } else if (action.action === 'unlink') {
        entityLinkService.unlink(
          action.sourceType,
          action.sourceId,
          action.targetType,
          action.targetId
        )
        results.push({
          action: 'unlink',
          sourceType: action.sourceType,
          sourceId: action.sourceId,
          targetType: action.targetType,
          targetId: action.targetId,
          success: true
        })
      } else if (action.action === 'list') {
        const linked = entityLinkService.getLinked(action.entityType, action.entityId)
        results.push({
          action: 'list',
          entityType: action.entityType,
          entityId: action.entityId,
          success: true,
          linkedItems: linked.map((l) => ({
            type: l.entityType,
            id: l.entityId,
            title: l.title
          }))
        })
      }
    }

    return { results }
  })
}

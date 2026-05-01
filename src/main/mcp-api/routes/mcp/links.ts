import type { Router } from '../../router'
import { requireBody, resolveActiveWorkspace, assertValidId } from './helpers'
import { entityLinkService } from '../../../services/entity-link'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import type { LinkAction, ManageLinkResult } from './types'

export function registerMcpLinkRoutes(router: Router): void {
  router.addRoute<{ actions: LinkAction[] }>('POST', '/api/mcp/links/batch', (_params, body) => {
    requireBody(body)
    const wsId = resolveActiveWorkspace()
    const { actions } = body as { actions: LinkAction[] }

    const results = processBatchActions<LinkAction, ManageLinkResult>(actions, (action) => {
      if (action.action === 'link') {
        assertValidId(action.sourceId, `${action.sourceType} sourceId`)
        assertValidId(action.targetId, `${action.targetType} targetId`)
        entityLinkService.link(
          action.sourceType,
          action.sourceId,
          action.targetType,
          action.targetId,
          wsId
        )
        return {
          action: 'link',
          sourceType: action.sourceType,
          sourceId: action.sourceId,
          targetType: action.targetType,
          targetId: action.targetId,
          success: true
        }
      }
      if (action.action === 'unlink') {
        assertValidId(action.sourceId, `${action.sourceType} sourceId`)
        assertValidId(action.targetId, `${action.targetType} targetId`)
        entityLinkService.unlink(
          action.sourceType,
          action.sourceId,
          action.targetType,
          action.targetId,
          wsId
        )
        return {
          action: 'unlink',
          sourceType: action.sourceType,
          sourceId: action.sourceId,
          targetType: action.targetType,
          targetId: action.targetId,
          success: true
        }
      }
      // list
      assertValidId(action.entityId, `${action.entityType} entityId`)
      const linked = entityLinkService.getLinked(action.entityType, action.entityId, wsId)
      return {
        action: 'list',
        entityType: action.entityType,
        entityId: action.entityId,
        success: true,
        linkedItems: linked.map((l) => ({
          type: l.entityType,
          id: l.entityId,
          title: l.title
        }))
      }
    })

    // mutation 액션이 있었다면 broadcast (list 단독 호출은 read-only이므로 건너뜀)
    const hadMutation = actions.some((a) => a.action === 'link' || a.action === 'unlink')
    if (hadMutation) {
      broadcastChanged('entity-link:changed', wsId, [])
      // todo와 연결된 link 변경은 todo 목록 + 히스토리에도 영향
      broadcastChanged('todo:changed', wsId, [])
    }

    return { results }
  })
}

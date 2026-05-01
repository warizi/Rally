import type { Router } from '../../router'
import { requireBody, resolveActiveWorkspace } from './helpers'
import { entityLinkService } from '../../../services/entity-link'
import { withTransaction } from '../../../lib/transaction'
import { broadcastChanged } from '../../lib/broadcast'
import type { LinkAction, ManageLinkResult } from './types'

export function registerMcpLinkRoutes(router: Router): void {
  router.addRoute<{ actions: LinkAction[] }>('POST', '/api/mcp/links/batch', (_params, body) => {
    requireBody(body)
    const wsId = resolveActiveWorkspace()
    const { actions } = body as { actions: LinkAction[] }

    // pure DB 작업 — 단일 트랜잭션으로 묶어 부분 commit 방지.
    // list 액션도 같이 묶지만 read-only이므로 안전.
    const results = withTransaction((): ManageLinkResult[] => {
      const acc: ManageLinkResult[] = []
      for (const action of actions) {
        if (action.action === 'link') {
          entityLinkService.link(
            action.sourceType,
            action.sourceId,
            action.targetType,
            action.targetId,
            wsId
          )
          acc.push({
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
            action.targetId,
            wsId
          )
          acc.push({
            action: 'unlink',
            sourceType: action.sourceType,
            sourceId: action.sourceId,
            targetType: action.targetType,
            targetId: action.targetId,
            success: true
          })
        } else if (action.action === 'list') {
          const linked = entityLinkService.getLinked(action.entityType, action.entityId, wsId)
          acc.push({
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
      return acc
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

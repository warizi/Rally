import type { Router } from '../../router'
import { requireBody, resolveActiveWorkspace, assertValidId } from './helpers'
import { entityLinkService } from '../../../services/entity-link'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import { ValidationError } from '../../../lib/errors'
import { LINKABLE_ENTITY_TYPES, type LinkableEntityType } from '../../../db/schema/entity-link'
import type { LinkAction, ManageLinkResult } from './types'

interface GraphNode {
  type: LinkableEntityType
  id: string
  title: string
  depth: number
}
interface GraphEdge {
  fromType: LinkableEntityType
  fromId: string
  toType: LinkableEntityType
  toId: string
}

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

  // ─── GET /api/mcp/explore-graph → explore_graph ───────────
  // seed 엔티티에서 entity_links를 depth홉까지 BFS 순회 (관계 이웃 탐색).
  router.addRoute('GET', '/api/mcp/explore-graph', (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const type = query.get('type') as LinkableEntityType
    const id = query.get('id') || ''
    if (!LINKABLE_ENTITY_TYPES.includes(type)) {
      throw new ValidationError(`Invalid entity type: ${type}`)
    }
    assertValidId(id, `${type} id`)
    const depth = Math.min(3, Math.max(1, parseInt(query.get('depth') || '1', 10) || 1))

    const visited = new Set<string>([`${type}:${id}`])
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    let frontier: { type: LinkableEntityType; id: string }[] = [{ type, id }]

    // seed는 워크스페이스 검증, 이웃은 검증 생략(링크가 ws-scoped라 동일 ws 보장)
    let first = true
    for (let d = 1; d <= depth && frontier.length > 0; d++) {
      const next: { type: LinkableEntityType; id: string }[] = []
      for (const node of frontier) {
        const linked = first
          ? entityLinkService.getLinked(node.type, node.id, wsId)
          : entityLinkService.getLinked(node.type, node.id)
        for (const l of linked) {
          edges.push({
            fromType: node.type,
            fromId: node.id,
            toType: l.entityType,
            toId: l.entityId
          })
          const key = `${l.entityType}:${l.entityId}`
          if (!visited.has(key)) {
            visited.add(key)
            nodes.push({ type: l.entityType, id: l.entityId, title: l.title, depth: d })
            next.push({ type: l.entityType, id: l.entityId })
          }
        }
      }
      first = false
      frontier = next
    }

    return { root: { type, id }, depth, nodes, edges }
  })
}

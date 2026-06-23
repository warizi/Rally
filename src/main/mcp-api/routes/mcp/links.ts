import type { Router } from '../../router'
import { requireBody, resolveActiveWorkspace, assertValidId } from './helpers'
import { entityLinkService } from '../../../services/entity-link'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import { recordGroupedActivity, type McpActivityOperation } from '../../lib/activity'
import { noteRepository } from '../../../repositories/note'
import { csvFileRepository } from '../../../repositories/csv-file'
import { canvasRepository } from '../../../repositories/canvas'
import { todoRepository } from '../../../repositories/todo'
import { pdfFileRepository } from '../../../repositories/pdf-file'
import { imageFileRepository } from '../../../repositories/image-file'
import { scheduleRepository } from '../../../repositories/schedule'
import type { LinkAction, ManageLinkResult } from './types'

/** 링크 토스트 표시용 — 엔티티 제목 (타입명 대신) */
function linkEntityTitle(type: string, id: string): string {
  switch (type) {
    case 'note':
      return noteRepository.findById(id)?.title ?? id
    case 'csv':
      return csvFileRepository.findById(id)?.title ?? id
    case 'canvas':
      return canvasRepository.findById(id)?.title ?? id
    case 'todo':
      return todoRepository.findById(id)?.title ?? id
    case 'pdf':
      return pdfFileRepository.findById(id)?.title ?? id
    case 'image':
      return imageFileRepository.findById(id)?.title ?? id
    case 'schedule':
      return scheduleRepository.findById(id)?.title ?? id
    default:
      return id
  }
}

export function registerMcpLinkRoutes(router: Router): void {
  router.addRoute<{ actions: LinkAction[] }>(
    'POST',
    '/api/mcp/links/batch',
    (_params, body, _query, ctx) => {
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

      recordGroupedActivity(
        ctx.recordActivity,
        actions.flatMap((action, i) => {
          const r = results[i]
          if (!r?.success || action.action === 'list') return []
          const operation: McpActivityOperation = action.action === 'link' ? 'link' : 'unlink'
          return [
            {
              domain: 'link' as const,
              operation,
              item: {
                type: 'link' as const,
                id: action.sourceId,
                title: `${linkEntityTitle(action.sourceType, action.sourceId)} ↔ ${linkEntityTitle(action.targetType, action.targetId)}`
              }
            }
          ]
        })
      )

      return { results }
    }
  )
}

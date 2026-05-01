import type { Router } from '../../router'
import { ValidationError } from '../../../lib/errors'
import { templateService } from '../../../services/template'
import { templateRepository } from '../../../repositories/template'
import { processBatchActions } from '../../../lib/batch'
import { broadcastChanged } from '../../lib/broadcast'
import {
  requireBody,
  resolveActiveWorkspace,
  assertOwnedByWorkspace,
  assertValidId
} from './helpers'
import type { TemplateAction, ManageTemplateResult, TemplateSummary, TemplateDetail } from './types'

function toSummary(item: ReturnType<typeof templateService.findById>): TemplateSummary {
  return {
    id: item.id,
    workspaceId: item.workspaceId,
    title: item.title,
    type: item.type,
    createdAt: item.createdAt.toISOString()
  }
}

function toDetail(item: ReturnType<typeof templateService.findById>): TemplateDetail {
  return { ...toSummary(item), jsonData: item.jsonData }
}

export function registerMcpTemplateRoutes(router: Router): void {
  // ─── GET /api/mcp/templates → list_templates ──────────────
  // type 옵션. jsonData는 응답에서 제외 (큼 — read_template으로 별도 fetch)

  router.addRoute('GET', '/api/mcp/templates', (_params, _body, query) => {
    const wsId = resolveActiveWorkspace()
    const typeRaw = query.get('type')
    let type: 'note' | 'csv' | undefined
    if (typeRaw) {
      if (typeRaw !== 'note' && typeRaw !== 'csv') {
        throw new ValidationError(`Invalid template type: ${typeRaw}. Must be 'note' or 'csv'.`)
      }
      type = typeRaw
    }
    const items = templateService.listAll(wsId, type)
    return { templates: items.map(toSummary) }
  })

  // ─── GET /api/mcp/templates/:id → read_template ───────────

  router.addRoute('GET', '/api/mcp/templates/:id', (params) => {
    const wsId = resolveActiveWorkspace()
    assertValidId(params.id, 'template id')
    const row = templateRepository.findById(params.id)
    assertOwnedByWorkspace(row, wsId, `Template not found: ${params.id}`)
    return toDetail(templateService.findById(params.id))
  })

  // ─── POST /api/mcp/templates/batch → manage_templates ─────
  // create / delete 만 지원 (UI도 update 미지원)

  router.addRoute<{ actions: TemplateAction[] }>(
    'POST',
    '/api/mcp/templates/batch',
    (_, body): { results: ManageTemplateResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()

      const results = processBatchActions<TemplateAction, ManageTemplateResult>(
        body.actions,
        (action) => {
          if (action.action === 'create') {
            const created = templateService.create({
              workspaceId: wsId,
              title: action.title,
              type: action.type,
              jsonData: action.jsonData
            })
            return { action: 'create', id: created.id, success: true }
          }
          // delete
          assertValidId(action.id, 'template id')
          const existing = templateRepository.findById(action.id)
          assertOwnedByWorkspace(existing, wsId, `Template not found: ${action.id}`)
          templateService.delete(action.id)
          return { action: 'delete', id: action.id, success: true }
        },
        { transactional: true }
      )

      broadcastChanged('template:changed', wsId, [])
      return { results }
    }
  )
}

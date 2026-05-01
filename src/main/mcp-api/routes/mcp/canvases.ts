import type { Router } from '../../router'
import type {
  ReadCanvasResponse,
  CreatedNodeInfo,
  CreateCanvasResponse,
  CreateCanvasBody,
  EditCanvasResult,
  EditCanvasAction
} from './types'
import { canvasService } from '../../../services/canvas'
import { canvasNodeService } from '../../../services/canvas-node'
import { canvasEdgeService } from '../../../services/canvas-edge'
import { ValidationError } from '../../../lib/errors'
import { withTransaction } from '../../../lib/transaction'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace } from './helpers'

export function registerMcpCanvasRoutes(router: Router): void {
  // ─── GET /api/mcp/canvases/:canvasId → read_canvas ────────

  router.addRoute('GET', '/api/mcp/canvases/:canvasId', (params): ReadCanvasResponse => {
    resolveActiveWorkspace()
    const canvas = canvasService.findById(params.canvasId)
    const nodes = canvasNodeService.findByCanvas(params.canvasId)
    const edges = canvasEdgeService.findByCanvas(params.canvasId)
    return {
      canvas: {
        id: canvas.id,
        title: canvas.title,
        description: canvas.description,
        createdAt: canvas.createdAt.toISOString(),
        updatedAt: canvas.updatedAt.toISOString()
      },
      nodes,
      edges
    }
  })

  // ─── POST /api/mcp/canvases → create_canvas ───────────────

  router.addRoute<CreateCanvasBody>(
    'POST',
    '/api/mcp/canvases',
    (_, body): CreateCanvasResponse => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()

      if (body.edges?.length && !body.nodes?.length)
        throw new ValidationError('edges require nodes to reference')

      // 캔버스 + 노드 + 엣지 생성 전체를 단일 트랜잭션으로.
      // 중간 실패 시 빈 캔버스/orphan 노드 잔존 방지.
      const { canvas, createdNodes, createdEdges } = withTransaction(() => {
        const canvas = canvasService.create(wsId, {
          title: body.title,
          description: body.description
        })

        const createdNodes: CreatedNodeInfo[] = []
        if (body.nodes?.length) {
          for (const [index, node] of body.nodes.entries()) {
            const result = canvasNodeService.create(canvas.id, {
              type: node.type,
              x: node.x,
              y: node.y,
              width: node.width,
              height: node.height,
              content: node.content,
              refId: node.refId,
              color: node.color
            })
            createdNodes.push({ index, id: result.id, type: result.type, x: result.x, y: result.y })
          }
        }

        const createdEdges: ReturnType<typeof canvasEdgeService.create>[] = []
        if (body.edges?.length) {
          for (const edge of body.edges) {
            const fromNode = createdNodes[edge.fromNodeIndex]?.id
            const toNode = createdNodes[edge.toNodeIndex]?.id
            if (!fromNode) throw new ValidationError(`Invalid fromNodeIndex: ${edge.fromNodeIndex}`)
            if (!toNode) throw new ValidationError(`Invalid toNodeIndex: ${edge.toNodeIndex}`)

            const result = canvasEdgeService.create(canvas.id, {
              fromNode,
              toNode,
              fromSide: edge.fromSide,
              toSide: edge.toSide,
              label: edge.label,
              color: edge.color,
              style: edge.style,
              arrow: edge.arrow
            })
            createdEdges.push(result)
          }
        }

        return { canvas, createdNodes, createdEdges }
      })

      broadcastChanged('canvas:changed', wsId, [])

      return {
        canvas: { id: canvas.id, title: canvas.title, description: canvas.description },
        nodes: createdNodes,
        edges: createdEdges
      }
    }
  )

  // ─── POST /api/mcp/canvases/:canvasId/edit → edit_canvas ──

  router.addRoute<{ actions: EditCanvasAction[] }>(
    'POST',
    '/api/mcp/canvases/:canvasId/edit',
    (params, body): { results: EditCanvasResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()
      if (!Array.isArray(body.actions) || body.actions.length === 0)
        throw new ValidationError('actions array is required')
      const actions = body.actions

      const hasDelete = actions.some((a) => a.action === 'delete')
      if (hasDelete && actions.length > 1)
        throw new ValidationError('delete action must be used alone')

      if (hasDelete) {
        // 단독 delete — 트랜잭션 불필요 (단일 작업)
        canvasService.remove(params.canvasId)
        broadcastChanged('canvas:changed', wsId, [])
        return { results: [{ action: 'delete', success: true }] }
      }

      // 다중 액션을 단일 트랜잭션으로 — pure DB이므로 안전하게 묶음
      const results = withTransaction((): EditCanvasResult[] => {
        const tempIdMap = new Map<string, string>()
        const acc: EditCanvasResult[] = []

        for (const action of actions) {
          switch (action.action) {
            case 'update':
              canvasService.update(params.canvasId, {
                title: action.title,
                description: action.description
              })
              acc.push({ action: 'update', success: true })
              break
            case 'add_node': {
              const result = canvasNodeService.create(params.canvasId, {
                type: action.type,
                x: action.x,
                y: action.y,
                width: action.width,
                height: action.height,
                content: action.content,
                refId: action.refId,
                color: action.color
              })
              if (action.tempId) tempIdMap.set(action.tempId, result.id)
              acc.push({
                action: 'add_node',
                tempId: action.tempId || undefined,
                id: result.id
              })
              break
            }
            case 'remove_node':
              canvasNodeService.remove(action.nodeId)
              acc.push({ action: 'remove_node', nodeId: action.nodeId, success: true })
              break
            case 'add_edge': {
              const fromNode = tempIdMap.get(action.fromNode) ?? action.fromNode
              const toNode = tempIdMap.get(action.toNode) ?? action.toNode
              const result = canvasEdgeService.create(params.canvasId, {
                fromNode,
                toNode,
                fromSide: action.fromSide,
                toSide: action.toSide,
                label: action.label,
                color: action.color,
                style: action.style,
                arrow: action.arrow
              })
              acc.push({ action: 'add_edge', id: result.id })
              break
            }
            case 'remove_edge':
              canvasEdgeService.remove(action.edgeId)
              acc.push({ action: 'remove_edge', edgeId: action.edgeId, success: true })
              break
          }
        }
        return acc
      })

      broadcastChanged('canvas:changed', wsId, [])
      return { results }
    }
  )
}

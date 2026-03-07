import type { Router } from '../router'
import { canvasService } from '../../services/canvas'
import { canvasNodeService } from '../../services/canvas-node'
import { canvasEdgeService } from '../../services/canvas-edge'
import { ValidationError } from '../../lib/errors'
import { broadcastChanged } from '../lib/broadcast'

function requireBody(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required')
  }
}

export function registerCanvasRoutes(router: Router): void {
  // GET /api/workspaces/:wsId/canvases
  router.addRoute('GET', '/api/workspaces/:wsId/canvases', (params) => {
    const canvases = canvasService.findByWorkspace(params.wsId)
    return {
      canvases: canvases.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString()
      }))
    }
  })

  // GET /api/workspaces/:wsId/canvases/:canvasId
  router.addRoute('GET', '/api/workspaces/:wsId/canvases/:canvasId', (params) => {
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

  // POST /api/workspaces/:wsId/canvases
  router.addRoute<{ title: string; description?: string }>(
    'POST',
    '/api/workspaces/:wsId/canvases',
    (params, body) => {
      requireBody(body)
      const result = canvasService.create(params.wsId, {
        title: body.title,
        description: body.description
      })

      broadcastChanged('canvas:changed', params.wsId, [])

      return {
        id: result.id,
        title: result.title,
        description: result.description
      }
    }
  )

  // PATCH /api/workspaces/:wsId/canvases/:canvasId
  router.addRoute<{ title?: string; description?: string }>(
    'PATCH',
    '/api/workspaces/:wsId/canvases/:canvasId',
    (params, body) => {
      requireBody(body)
      const result = canvasService.update(params.canvasId, {
        title: body.title,
        description: body.description
      })

      broadcastChanged('canvas:changed', params.wsId, [])

      return {
        id: result.id,
        title: result.title,
        description: result.description
      }
    }
  )

  // DELETE /api/workspaces/:wsId/canvases/:canvasId
  router.addRoute('DELETE', '/api/workspaces/:wsId/canvases/:canvasId', (params) => {
    canvasService.remove(params.canvasId)

    broadcastChanged('canvas:changed', params.wsId, [])

    return { success: true }
  })

  // POST /api/workspaces/:wsId/canvases/:canvasId/nodes
  router.addRoute<{
    type: string
    x: number
    y: number
    width?: number
    height?: number
    content?: string
    refId?: string
    color?: string
  }>('POST', '/api/workspaces/:wsId/canvases/:canvasId/nodes', (params, body) => {
    requireBody(body)
    const result = canvasNodeService.create(params.canvasId, {
      type: body.type as any,
      x: body.x,
      y: body.y,
      width: body.width,
      height: body.height,
      content: body.content,
      refId: body.refId,
      color: body.color
    })

    broadcastChanged('canvas:changed', params.wsId, [])

    return {
      id: result.id,
      canvasId: result.canvasId,
      type: result.type,
      x: result.x,
      y: result.y,
      width: result.width,
      height: result.height,
      content: result.content,
      refId: result.refId
    }
  })

  // DELETE /api/workspaces/:wsId/canvases/:canvasId/nodes/:nodeId
  router.addRoute('DELETE', '/api/workspaces/:wsId/canvases/:canvasId/nodes/:nodeId', (params) => {
    canvasNodeService.remove(params.nodeId)

    broadcastChanged('canvas:changed', params.wsId, [])

    return { success: true }
  })

  // POST /api/workspaces/:wsId/canvases/:canvasId/edges
  router.addRoute<{
    fromNode: string
    toNode: string
    fromSide?: string
    toSide?: string
    label?: string
    color?: string
    style?: string
    arrow?: string
  }>('POST', '/api/workspaces/:wsId/canvases/:canvasId/edges', (params, body) => {
    requireBody(body)
    const result = canvasEdgeService.create(params.canvasId, {
      fromNode: body.fromNode,
      toNode: body.toNode,
      fromSide: body.fromSide as any,
      toSide: body.toSide as any,
      label: body.label,
      color: body.color,
      style: body.style as any,
      arrow: body.arrow as any
    })

    broadcastChanged('canvas:changed', params.wsId, [])

    return {
      id: result.id,
      canvasId: result.canvasId,
      fromNode: result.fromNode,
      toNode: result.toNode,
      fromSide: result.fromSide,
      toSide: result.toSide,
      label: result.label,
      style: result.style,
      arrow: result.arrow
    }
  })

  // DELETE /api/workspaces/:wsId/canvases/:canvasId/edges/:edgeId
  router.addRoute('DELETE', '/api/workspaces/:wsId/canvases/:canvasId/edges/:edgeId', (params) => {
    canvasEdgeService.remove(params.edgeId)

    broadcastChanged('canvas:changed', params.wsId, [])

    return { success: true }
  })
}

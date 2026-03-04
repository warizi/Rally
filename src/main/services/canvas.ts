import { nanoid } from 'nanoid'
import { NotFoundError } from '../lib/errors'
import { canvasRepository } from '../repositories/canvas'
import { workspaceRepository } from '../repositories/workspace'

export interface CanvasItem {
  id: string
  workspaceId: string
  title: string
  description: string
  viewportX: number
  viewportY: number
  viewportZoom: number
  createdAt: Date
  updatedAt: Date
}

function toCanvasItem(row: NonNullable<ReturnType<typeof canvasRepository.findById>>): CanvasItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    description: row.description,
    viewportX: row.viewportX,
    viewportY: row.viewportY,
    viewportZoom: row.viewportZoom,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as number),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as number)
  }
}

export const canvasService = {
  findByWorkspace(workspaceId: string, search?: string): CanvasItem[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    return canvasRepository.findByWorkspaceId(workspaceId, search).map(toCanvasItem)
  },

  findById(canvasId: string): CanvasItem {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    return toCanvasItem(canvas)
  },

  create(workspaceId: string, data: { title: string; description?: string }): CanvasItem {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    const now = new Date()
    const row = canvasRepository.create({
      id: nanoid(),
      workspaceId,
      title: data.title.trim(),
      description: data.description?.trim() ?? '',
      createdAt: now,
      updatedAt: now
    })
    return toCanvasItem(row)
  },

  update(canvasId: string, data: { title?: string; description?: string }): CanvasItem {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    const updated = canvasRepository.update(canvasId, {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      updatedAt: new Date()
    })
    if (!updated) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    return toCanvasItem(updated)
  },

  updateViewport(canvasId: string, viewport: { x: number; y: number; zoom: number }): void {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    canvasRepository.updateViewport(canvasId, {
      viewportX: viewport.x,
      viewportY: viewport.y,
      viewportZoom: viewport.zoom
    })
  },

  remove(canvasId: string): void {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    // Phase 2: entityLinkService.removeAllLinks('canvas', canvasId) 호출 추가
    canvasRepository.delete(canvasId)
  }
}

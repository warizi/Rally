import { nanoid } from 'nanoid'
import { NotFoundError } from '../lib/errors'
import { canvasRepository } from '../repositories/canvas'
import { workspaceRepository } from '../repositories/workspace'
import { itemTagService } from './item-tag'
import { trashService } from './trash'

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

  /**
   * 제목/설명 LIKE 검색. matchType: title이 매칭되면 'title', 아니면 'description'.
   */
  search(
    workspaceId: string,
    query: string
  ): {
    id: string
    title: string
    description: string
    matchType: 'title' | 'description'
    updatedAt: Date
  }[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    if (!query.trim()) return []
    const rows = canvasRepository.findByWorkspaceId(workspaceId, query)
    const lower = query.toLowerCase()
    return rows.map((r) => {
      const updatedAt = r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt as number)
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        matchType: r.title.toLowerCase().includes(lower)
          ? ('title' as const)
          : ('description' as const),
        updatedAt
      }
    })
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

  remove(canvasId: string, options: { permanent?: boolean } = {}): void {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)

    if (!options.permanent) {
      trashService.softRemove(canvas.workspaceId, 'canvas', canvasId)
      return
    }

    // 영구 삭제 — Phase 2: entityLinkService.removeAllLinks('canvas', canvasId) 호출 추가
    itemTagService.removeByItem('canvas', canvasId)
    canvasRepository.delete(canvasId)
  }
}

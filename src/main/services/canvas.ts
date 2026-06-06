import { nanoid } from 'nanoid'
import { LockedError, NotFoundError } from '../lib/errors'
import { canvasRepository } from '../repositories/canvas'
import { workspaceRepository } from '../repositories/workspace'
import { itemTagService } from './item-tag'
import { trashService } from './trash'
import { embeddingService } from './embedding'
import { type Actor, USER_ACTOR, toCreatedFields, toUpdatedFields } from './_shared/actor'
import { toDate } from './_shared/date'

export interface CanvasItem {
  id: string
  workspaceId: string
  title: string
  description: string
  viewportX: number
  viewportY: number
  viewportZoom: number
  isLocked: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: 'user' | 'ai'
  createdById: string | null
  updatedBy: 'user' | 'ai'
  updatedById: string | null
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
    isLocked: row.isLocked,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    createdBy: (row.createdBy ?? 'user') as 'user' | 'ai',
    createdById: row.createdById ?? null,
    updatedBy: (row.updatedBy ?? 'user') as 'user' | 'ai',
    updatedById: row.updatedById ?? null
  }
}

function assertCanvasUnlocked(canvas: { isLocked: boolean; title: string }): void {
  if (canvas.isLocked) throw new LockedError(`잠금된 캔버스는 수정할 수 없습니다: ${canvas.title}`)
}

// 다른 서비스(canvas-node, canvas-edge)에서 캔버스 잠금 가드를 사용할 수 있도록 export
export function assertCanvasUnlockedById(canvasId: string): void {
  const canvas = canvasRepository.findById(canvasId)
  if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
  assertCanvasUnlocked(canvas)
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
      const updatedAt = toDate(r.updatedAt)
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

  create(
    workspaceId: string,
    data: { title: string; description?: string },
    actor: Actor = USER_ACTOR
  ): CanvasItem {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    const now = new Date()
    const row = canvasRepository.create({
      id: nanoid(),
      workspaceId,
      title: data.title.trim(),
      description: data.description?.trim() ?? '',
      createdAt: now,
      updatedAt: now,
      ...toCreatedFields(actor)
    })
    embeddingService.enqueue('canvas', row.id)
    return toCanvasItem(row)
  },

  update(
    canvasId: string,
    data: { title?: string; description?: string },
    actor: Actor = USER_ACTOR
  ): CanvasItem {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    assertCanvasUnlocked(canvas)
    const updated = canvasRepository.update(canvasId, {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      updatedAt: new Date(),
      ...toUpdatedFields(actor)
    })
    if (!updated) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    embeddingService.enqueue('canvas', canvasId)
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
    // soft-delete 만 잠금 차단. permanent 는 휴지통 purge 경로라 통과.
    if (!options.permanent) assertCanvasUnlocked(canvas)

    embeddingService.remove('canvas', canvasId)

    if (!options.permanent) {
      trashService.softRemove(canvas.workspaceId, 'canvas', canvasId)
      return
    }

    // 영구 삭제 — Phase 2: entityLinkService.removeAllLinks('canvas', canvasId) 호출 추가
    itemTagService.removeByItem('canvas', canvasId)
    canvasRepository.delete(canvasId)
  },

  /**
   * 잠금 토글 — 가드 우회. 잠긴 상태에서도 해제 가능.
   */
  toggleLock(canvasId: string, isLocked: boolean, actor: Actor = USER_ACTOR): CanvasItem {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)

    const updated = canvasRepository.update(canvasId, {
      isLocked,
      updatedAt: new Date(),
      ...toUpdatedFields(actor)
    })
    if (!updated) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    return toCanvasItem(updated)
  }
}

import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { canvasGroupRepository } from '../repositories/canvas-group'
import { canvasNodeRepository } from '../repositories/canvas-node'
import { canvasRepository } from '../repositories/canvas'
import { assertCanvasUnlockedById } from './canvas'
import { toDate } from './_shared/date'

export interface CanvasGroupItem {
  id: string
  canvasId: string
  parentId: string | null
  label: string | null
  x: number
  y: number
  width: number
  height: number
  color: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateCanvasGroupData {
  parentId?: string | null
  label?: string
  x: number
  y: number
  width: number
  height: number
  color?: string
}

export interface UpdateCanvasGroupData {
  parentId?: string | null
  label?: string | null
  x?: number
  y?: number
  width?: number
  height?: number
  color?: string | null
}

function toCanvasGroupItem(
  row: NonNullable<ReturnType<typeof canvasGroupRepository.findById>>
): CanvasGroupItem {
  return {
    id: row.id,
    canvasId: row.canvasId,
    parentId: row.parentId,
    label: row.label,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    color: row.color,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt)
  }
}

function assertPositiveSize(width?: number, height?: number): void {
  if (width !== undefined && width <= 0) {
    throw new ValidationError('Group width must be positive')
  }
  if (height !== undefined && height <= 0) {
    throw new ValidationError('Group height must be positive')
  }
}

export const canvasGroupService = {
  findByCanvas(canvasId: string): CanvasGroupItem[] {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    return canvasGroupRepository.findByCanvasId(canvasId).map(toCanvasGroupItem)
  },

  create(canvasId: string, data: CreateCanvasGroupData): CanvasGroupItem {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    assertCanvasUnlockedById(canvasId)
    assertPositiveSize(data.width, data.height)
    const now = new Date()
    const row = canvasGroupRepository.create({
      id: nanoid(),
      canvasId,
      parentId: data.parentId ?? null,
      label: data.label ?? null,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      color: data.color ?? null,
      createdAt: now,
      updatedAt: now
    })
    return toCanvasGroupItem(row)
  },

  update(groupId: string, data: UpdateCanvasGroupData): CanvasGroupItem {
    const group = canvasGroupRepository.findById(groupId)
    if (!group) throw new NotFoundError(`Canvas group not found: ${groupId}`)
    assertCanvasUnlockedById(group.canvasId)
    assertPositiveSize(data.width, data.height)
    // 순환 참조 방어 — groupId 를 자기 자신/자손의 자식으로 만들려는 시도 차단.
    if (data.parentId) {
      if (data.parentId === groupId) {
        throw new ValidationError('Group cannot be its own parent')
      }
      let cursor = canvasGroupRepository.findById(data.parentId)
      const guard = new Set<string>()
      while (cursor) {
        if (cursor.id === groupId) {
          throw new ValidationError('Group cannot be nested into its own descendant')
        }
        if (!cursor.parentId || guard.has(cursor.id)) break
        guard.add(cursor.id)
        cursor = canvasGroupRepository.findById(cursor.parentId)
      }
    }
    const updated = canvasGroupRepository.update(groupId, {
      ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
      ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.x !== undefined ? { x: data.x } : {}),
      ...(data.y !== undefined ? { y: data.y } : {}),
      ...(data.width !== undefined ? { width: data.width } : {}),
      ...(data.height !== undefined ? { height: data.height } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      updatedAt: new Date()
    })
    if (!updated) throw new NotFoundError(`Canvas group not found: ${groupId}`)
    return toCanvasGroupItem(updated)
  },

  /**
   * 그룹 삭제(고아화 정책). 멤버 노드와 자식 그룹은 보존하되 소속만 해제한다.
   * - 멤버 노드: groupId 해제 → 캔버스에 남음
   * - 자식 그룹: parentId 해제 → 최상위 그룹으로 남음(자식 그룹의 멤버는 그대로)
   * FK ON DELETE SET NULL 을 ALTER TABLE 이 보장하지 못하므로 명시적으로 끊는다.
   */
  remove(groupId: string): void {
    const group = canvasGroupRepository.findById(groupId)
    if (!group) throw new NotFoundError(`Canvas group not found: ${groupId}`)
    assertCanvasUnlockedById(group.canvasId)
    canvasNodeRepository.clearGroupId(groupId)
    canvasGroupRepository.clearParentId(groupId)
    canvasGroupRepository.delete(groupId)
  }
}

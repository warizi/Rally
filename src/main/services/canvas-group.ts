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
  label?: string
  x: number
  y: number
  width: number
  height: number
  color?: string
}

export interface UpdateCanvasGroupData {
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
    const updated = canvasGroupRepository.update(groupId, {
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
   * 그룹 삭제. 멤버 노드는 보존하되 groupId만 해제한다(노드 자체는 남는다).
   * FK ON DELETE SET NULL 을 ALTER TABLE 이 보장하지 못하므로 명시적으로 끊는다.
   */
  remove(groupId: string): void {
    const group = canvasGroupRepository.findById(groupId)
    if (!group) throw new NotFoundError(`Canvas group not found: ${groupId}`)
    assertCanvasUnlockedById(group.canvasId)
    canvasNodeRepository.clearGroupId(groupId)
    canvasGroupRepository.delete(groupId)
  }
}

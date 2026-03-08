import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { canvasEdgeRepository } from '../repositories/canvas-edge'
import { canvasRepository } from '../repositories/canvas'
import { canvasNodeRepository } from '../repositories/canvas-node'

export type CanvasEdgeSide = 'top' | 'right' | 'bottom' | 'left'
export type CanvasEdgeStyle = 'solid' | 'dashed' | 'dotted'
export type CanvasEdgeArrow = 'none' | 'end' | 'both'

export interface CanvasEdgeItem {
  id: string
  canvasId: string
  fromNode: string
  toNode: string
  fromSide: CanvasEdgeSide
  toSide: CanvasEdgeSide
  label: string | null
  color: string | null
  style: CanvasEdgeStyle
  arrow: CanvasEdgeArrow
  createdAt: Date
}

export interface CreateCanvasEdgeData {
  fromNode: string
  toNode: string
  fromSide?: CanvasEdgeSide
  toSide?: CanvasEdgeSide
  label?: string
  color?: string
  style?: CanvasEdgeStyle
  arrow?: CanvasEdgeArrow
}

export interface UpdateCanvasEdgeData {
  fromSide?: CanvasEdgeSide
  toSide?: CanvasEdgeSide
  label?: string
  color?: string
  style?: CanvasEdgeStyle
  arrow?: CanvasEdgeArrow
}

function toCanvasEdgeItem(
  row: NonNullable<ReturnType<typeof canvasEdgeRepository.findById>>
): CanvasEdgeItem {
  return {
    id: row.id,
    canvasId: row.canvasId,
    fromNode: row.fromNode,
    toNode: row.toNode,
    fromSide: row.fromSide,
    toSide: row.toSide,
    label: row.label,
    color: row.color,
    style: row.style,
    arrow: row.arrow,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as number)
  }
}

export const canvasEdgeService = {
  findByCanvas(canvasId: string): CanvasEdgeItem[] {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    return canvasEdgeRepository.findByCanvasId(canvasId).map(toCanvasEdgeItem)
  },

  create(canvasId: string, data: CreateCanvasEdgeData): CanvasEdgeItem {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)

    // Self-loop 불가
    if (data.fromNode === data.toNode) {
      throw new ValidationError('Cannot create self-loop edge')
    }

    // from/to 노드 존재 확인
    const fromNode = canvasNodeRepository.findById(data.fromNode)
    if (!fromNode) throw new NotFoundError(`From node not found: ${data.fromNode}`)
    const toNode = canvasNodeRepository.findById(data.toNode)
    if (!toNode) throw new NotFoundError(`To node not found: ${data.toNode}`)

    // 같은 방향 중복 엣지 불가
    const existing = canvasEdgeRepository.findByCanvasId(canvasId)
    const duplicate = existing.some((e) => e.fromNode === data.fromNode && e.toNode === data.toNode)
    if (duplicate) {
      throw new ValidationError('Duplicate edge already exists')
    }

    const row = canvasEdgeRepository.create({
      id: nanoid(),
      canvasId,
      fromNode: data.fromNode,
      toNode: data.toNode,
      fromSide: data.fromSide ?? 'right',
      toSide: data.toSide ?? 'left',
      label: data.label ?? null,
      color: data.color ?? null,
      style: data.style ?? 'solid',
      arrow: data.arrow ?? 'end',
      createdAt: new Date()
    })
    return toCanvasEdgeItem(row)
  },

  update(edgeId: string, data: UpdateCanvasEdgeData): CanvasEdgeItem {
    const edge = canvasEdgeRepository.findById(edgeId)
    if (!edge) throw new NotFoundError(`Canvas edge not found: ${edgeId}`)
    const updated = canvasEdgeRepository.update(edgeId, {
      ...(data.fromSide !== undefined ? { fromSide: data.fromSide } : {}),
      ...(data.toSide !== undefined ? { toSide: data.toSide } : {}),
      ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.style !== undefined ? { style: data.style } : {}),
      ...(data.arrow !== undefined ? { arrow: data.arrow } : {})
    })
    if (!updated) throw new NotFoundError(`Canvas edge not found: ${edgeId}`)
    return toCanvasEdgeItem(updated)
  },

  remove(edgeId: string): void {
    const edge = canvasEdgeRepository.findById(edgeId)
    if (!edge) throw new NotFoundError(`Canvas edge not found: ${edgeId}`)
    canvasEdgeRepository.delete(edgeId)
  }
}

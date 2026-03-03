import { nanoid } from 'nanoid'
import { NotFoundError } from '../lib/errors'
import { canvasNodeRepository } from '../repositories/canvas-node'
import { canvasRepository } from '../repositories/canvas'
import { todoRepository } from '../repositories/todo'
import { noteRepository } from '../repositories/note'
import { scheduleRepository } from '../repositories/schedule'
import { csvFileRepository } from '../repositories/csv-file'
import { pdfFileRepository } from '../repositories/pdf-file'
import { imageFileRepository } from '../repositories/image-file'
import type { CanvasNodeType } from '../db/schema/canvas-node'

export interface CanvasNodeItem {
  id: string
  canvasId: string
  type: CanvasNodeType
  refId: string | null
  x: number
  y: number
  width: number
  height: number
  color: string | null
  content: string | null
  zIndex: number
  createdAt: Date
  updatedAt: Date
  refTitle?: string
  refPreview?: string
  refMeta?: Record<string, unknown>
}

export interface CreateCanvasNodeData {
  type: CanvasNodeType
  refId?: string
  x: number
  y: number
  width?: number
  height?: number
  color?: string
  content?: string
}

export interface UpdateCanvasNodeData {
  content?: string
  color?: string
  width?: number
  height?: number
  zIndex?: number
}

interface RefData {
  title: string
  preview: string
  meta?: Record<string, unknown>
}

function toCanvasNodeItem(
  row: NonNullable<ReturnType<typeof canvasNodeRepository.findById>>,
  refData?: RefData
): CanvasNodeItem {
  return {
    id: row.id,
    canvasId: row.canvasId,
    type: row.type as CanvasNodeType,
    refId: row.refId,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    color: row.color,
    content: row.content,
    zIndex: row.zIndex,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as number),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as number),
    refTitle: refData?.title,
    refPreview: refData?.preview,
    refMeta: refData?.meta
  }
}

/** type별 refId를 모아 batch fetch → Map<refId, RefData> */
function batchFetchRefs(
  nodes: ReturnType<typeof canvasNodeRepository.findByCanvasId>
): Map<string, RefData> {
  const refMap = new Map<string, RefData>()

  // type별 refId 수집
  const idsByType: Record<string, string[]> = {}
  for (const node of nodes) {
    if (!node.refId || node.type === 'text') continue
    if (!idsByType[node.type]) idsByType[node.type] = []
    idsByType[node.type].push(node.refId)
  }

  // batch fetch per type
  if (idsByType.todo?.length) {
    for (const t of todoRepository.findByIds(idsByType.todo)) {
      refMap.set(t.id, {
        title: t.title,
        preview: (t.description ?? '').slice(0, 200),
        meta: {
          isDone: t.isDone,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          startDate: t.startDate
        }
      })
    }
  }
  if (idsByType.note?.length) {
    for (const n of noteRepository.findByIds(idsByType.note)) {
      refMap.set(n.id, { title: n.title, preview: (n.preview ?? '').slice(0, 200) })
    }
  }
  if (idsByType.schedule?.length) {
    for (const s of scheduleRepository.findByIds(idsByType.schedule)) {
      refMap.set(s.id, {
        title: s.title,
        preview: s.description ?? s.location ?? '',
        meta: {
          description: s.description,
          location: s.location,
          allDay: s.allDay,
          startAt: s.startAt,
          endAt: s.endAt,
          color: s.color,
          priority: s.priority
        }
      })
    }
  }
  if (idsByType.csv?.length) {
    for (const c of csvFileRepository.findByIds(idsByType.csv)) {
      refMap.set(c.id, { title: c.title, preview: c.preview ?? '' })
    }
  }
  if (idsByType.pdf?.length) {
    for (const p of pdfFileRepository.findByIds(idsByType.pdf)) {
      refMap.set(p.id, { title: p.title, preview: p.preview ?? '' })
    }
  }
  if (idsByType.image?.length) {
    for (const img of imageFileRepository.findByIds(idsByType.image)) {
      refMap.set(img.id, { title: img.title, preview: img.description ?? '' })
    }
  }

  return refMap
}

export const canvasNodeService = {
  findByCanvas(canvasId: string): CanvasNodeItem[] {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    const nodes = canvasNodeRepository.findByCanvasId(canvasId)
    const refMap = batchFetchRefs(nodes)
    return nodes.map((n) => toCanvasNodeItem(n, n.refId ? refMap.get(n.refId) : undefined))
  },

  /** ref 데이터만 다시 fetch (탭 활성화 시 부분 갱신용) */
  fetchRefData(canvasId: string): Map<string, RefData> {
    const nodes = canvasNodeRepository.findByCanvasId(canvasId)
    return batchFetchRefs(nodes)
  },

  create(canvasId: string, data: CreateCanvasNodeData): CanvasNodeItem {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    const now = new Date()
    const row = canvasNodeRepository.create({
      id: nanoid(),
      canvasId,
      type: data.type,
      refId: data.refId ?? null,
      x: data.x,
      y: data.y,
      width: data.width ?? 260,
      height: data.height ?? 160,
      color: data.color ?? null,
      content: data.content ?? null,
      zIndex: 0,
      createdAt: now,
      updatedAt: now
    })
    return toCanvasNodeItem(row)
  },

  update(nodeId: string, data: UpdateCanvasNodeData): CanvasNodeItem {
    const node = canvasNodeRepository.findById(nodeId)
    if (!node) throw new NotFoundError(`Canvas node not found: ${nodeId}`)
    const updated = canvasNodeRepository.update(nodeId, {
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.width !== undefined ? { width: data.width } : {}),
      ...(data.height !== undefined ? { height: data.height } : {}),
      ...(data.zIndex !== undefined ? { zIndex: data.zIndex } : {}),
      updatedAt: new Date()
    })
    if (!updated) throw new NotFoundError(`Canvas node not found: ${nodeId}`)
    return toCanvasNodeItem(updated)
  },

  updatePositions(updates: { id: string; x: number; y: number }[]): void {
    canvasNodeRepository.bulkUpdatePositions(updates)
  },

  remove(nodeId: string): void {
    const node = canvasNodeRepository.findById(nodeId)
    if (!node) throw new NotFoundError(`Canvas node not found: ${nodeId}`)
    canvasNodeRepository.delete(nodeId)
    // FK CASCADE가 연결 엣지 자동 삭제
  }
}

import { nanoid } from 'nanoid'
import { LockedError, NotFoundError } from '../lib/errors'
import { assertCanvasUnlockedById } from './canvas'
import { db } from '../db'
import { canvasNodeRepository } from '../repositories/canvas-node'
import { canvasEdgeRepository } from '../repositories/canvas-edge'
import { canvasGroupRepository } from '../repositories/canvas-group'
import { canvasRepository } from '../repositories/canvas'
import { todoRepository } from '../repositories/todo'
import { noteRepository } from '../repositories/note'
import { scheduleRepository } from '../repositories/schedule'
import { csvFileRepository } from '../repositories/csv-file'
import { pdfFileRepository } from '../repositories/pdf-file'
import { imageFileRepository } from '../repositories/image-file'
import type { CanvasNodeType } from '../db/schema/canvas-node'
import { toDate } from './_shared/date'

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
  groupId: string | null
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
  groupId?: string | null
}

export interface UpdateCanvasNodeData {
  content?: string
  color?: string
  width?: number
  height?: number
  zIndex?: number
  /** 그룹 편입(groupId) / 이탈(null). 좌표 동시 갱신 시 x/y도 함께. */
  groupId?: string | null
  x?: number
  y?: number
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
    groupId: row.groupId,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
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
  if (idsByType.canvas?.length) {
    for (const c of canvasRepository.findByIds(idsByType.canvas)) {
      refMap.set(c.id, { title: c.title, preview: c.description ?? '' })
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
    if (canvas.isLocked)
      throw new LockedError(`잠금된 캔버스는 수정할 수 없습니다: ${canvas.title}`)
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
      groupId: data.groupId ?? null,
      createdAt: now,
      updatedAt: now
    })
    return toCanvasNodeItem(row)
  },

  update(nodeId: string, data: UpdateCanvasNodeData): CanvasNodeItem {
    const node = canvasNodeRepository.findById(nodeId)
    if (!node) throw new NotFoundError(`Canvas node not found: ${nodeId}`)
    assertCanvasUnlockedById(node.canvasId)
    const updated = canvasNodeRepository.update(nodeId, {
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.width !== undefined ? { width: data.width } : {}),
      ...(data.height !== undefined ? { height: data.height } : {}),
      ...(data.zIndex !== undefined ? { zIndex: data.zIndex } : {}),
      ...(data.groupId !== undefined ? { groupId: data.groupId } : {}),
      ...(data.x !== undefined ? { x: data.x } : {}),
      ...(data.y !== undefined ? { y: data.y } : {}),
      updatedAt: new Date()
    })
    if (!updated) throw new NotFoundError(`Canvas node not found: ${nodeId}`)
    return toCanvasNodeItem(updated)
  },

  updatePositions(updates: { id: string; x: number; y: number }[]): void {
    if (updates.length === 0) return
    // 첫 노드의 canvasId 로 잠금 검사 (positions는 단일 canvas 단위로만 호출됨)
    const firstNode = canvasNodeRepository.findById(updates[0].id)
    if (firstNode) assertCanvasUnlockedById(firstNode.canvasId)
    canvasNodeRepository.bulkUpdatePositions(updates)
  },

  remove(nodeId: string): void {
    const node = canvasNodeRepository.findById(nodeId)
    if (!node) throw new NotFoundError(`Canvas node not found: ${nodeId}`)
    assertCanvasUnlockedById(node.canvasId)
    canvasNodeRepository.delete(nodeId)
    // FK CASCADE가 연결 엣지 자동 삭제
  },

  syncState(
    canvasId: string,
    nodes: {
      id: string
      type: string
      refId: string | null
      x: number
      y: number
      width: number
      height: number
      color: string | null
      content: string | null
      zIndex: number
      groupId?: string | null
    }[],
    edges: {
      id: string
      fromNode: string
      toNode: string
      fromSide: string
      toSide: string
      label: string | null
      color: string | null
      style: string
      arrow: string
    }[],
    groups: {
      id: string
      label: string | null
      x: number
      y: number
      width: number
      height: number
      color: string | null
    }[] = []
  ): void {
    assertCanvasUnlockedById(canvasId)
    const now = new Date()
    db.$client.transaction(() => {
      canvasEdgeRepository.deleteByCanvasId(canvasId)
      canvasNodeRepository.deleteByCanvasId(canvasId)
      canvasGroupRepository.deleteByCanvasId(canvasId)
      // 그룹을 먼저 생성해야 노드의 group_id FK가 유효
      canvasGroupRepository.bulkCreate(
        groups.map((g) => ({
          id: g.id,
          canvasId,
          label: g.label,
          x: g.x,
          y: g.y,
          width: g.width,
          height: g.height,
          color: g.color,
          createdAt: now,
          updatedAt: now
        }))
      )
      canvasNodeRepository.bulkCreate(
        nodes.map((n) => ({
          id: n.id,
          canvasId,
          type: n.type as CanvasNodeType,
          refId: n.refId,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          color: n.color,
          content: n.content,
          zIndex: n.zIndex,
          groupId: n.groupId ?? null,
          createdAt: now,
          updatedAt: now
        }))
      )
      canvasEdgeRepository.bulkCreate(
        edges.map((e) => ({
          id: e.id,
          canvasId,
          fromNode: e.fromNode,
          toNode: e.toNode,
          fromSide: e.fromSide as 'top' | 'right' | 'bottom' | 'left',
          toSide: e.toSide as 'top' | 'right' | 'bottom' | 'left',
          label: e.label,
          color: e.color,
          style: e.style as 'solid' | 'dashed' | 'dotted',
          arrow: e.arrow as 'none' | 'end' | 'both',
          createdAt: now
        }))
      )
    })()
  }
}

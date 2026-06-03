import type { Node } from '@xyflow/react'
import type {
  CanvasNodeItem,
  CanvasGroupItem,
  CanvasEdgeItem,
  CanvasNode,
  GroupNode,
  CanvasEdge
} from './types'

/** 그룹 노드는 일반 노드·엣지보다 항상 뒤(아래)에 렌더되도록 음수 zIndex 고정 */
export const GROUP_Z_INDEX = -1

export function toReactFlowNode(item: CanvasNodeItem): CanvasNode {
  if (item.type === 'text') {
    return {
      id: item.id,
      type: 'textNode' as const,
      position: { x: item.x, y: item.y },
      data: {
        label: item.content ?? '',
        canvasId: item.canvasId,
        content: item.content,
        nodeType: 'text' as const,
        color: item.color,
        width: item.width,
        height: item.height,
        groupId: item.groupId
      },
      style: { width: item.width, height: item.height },
      zIndex: item.zIndex
    }
  }

  return {
    id: item.id,
    type: 'refNode' as const,
    position: { x: item.x, y: item.y },
    data: {
      label: item.refTitle ?? item.content ?? '',
      canvasId: item.canvasId,
      content: item.content,
      refId: item.refId,
      refTitle: item.refTitle,
      refPreview: item.refPreview,
      nodeType: item.type,
      color: item.color,
      width: item.width,
      height: item.height,
      refMeta: item.refMeta,
      groupId: item.groupId
    },
    style: { width: item.width, height: item.height },
    zIndex: item.zIndex
  }
}

export function toReactFlowGroupNode(item: CanvasGroupItem): GroupNode {
  return {
    id: item.id,
    type: 'groupNode' as const,
    position: { x: item.x, y: item.y },
    data: {
      canvasId: item.canvasId,
      nodeType: 'group' as const,
      label: item.label,
      color: item.color,
      width: item.width,
      height: item.height
    },
    style: { width: item.width, height: item.height },
    // 항상 뒤로 — 일반 노드·엣지보다 아래 레이어
    zIndex: GROUP_Z_INDEX,
    // 그룹 박스는 selectable 하되 드래그로 자식과 함께 이동(인터랙션 레이어에서 처리)
    selectable: true,
    draggable: true
  }
}

export function toReactFlowEdge(item: CanvasEdgeItem): CanvasEdge {
  return {
    id: item.id,
    source: item.fromNode,
    target: item.toNode,
    sourceHandle: item.fromSide,
    targetHandle: item.toSide,
    type: 'customEdge',
    label: item.label ?? undefined,
    style: {
      strokeDasharray:
        item.style === 'dashed' ? '5 5' : item.style === 'dotted' ? '2 2' : undefined,
      stroke: item.color ?? undefined
    },
    markerEnd:
      item.arrow === 'none' ? undefined : { type: 'arrowclosed' as const, width: 28, height: 28 },
    markerStart:
      item.arrow === 'both' ? { type: 'arrowclosed' as const, width: 28, height: 28 } : undefined,
    data: {
      edgeStyle: item.style,
      arrow: item.arrow,
      color: item.color,
      fromSide: item.fromSide,
      toSide: item.toSide
    }
  }
}

export function toPositionUpdate(node: Node): { id: string; x: number; y: number } {
  return {
    id: node.id,
    x: node.position.x,
    y: node.position.y
  }
}

export function parseSide(handle: string | null | undefined): 'top' | 'right' | 'bottom' | 'left' {
  const raw = (handle ?? 'right').replace(/-(?:source|target)$/, '')
  return raw as 'top' | 'right' | 'bottom' | 'left'
}

export function toCreateCanvasEdgeData(connection: {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}): {
  fromNode: string
  toNode: string
  fromSide: 'top' | 'right' | 'bottom' | 'left'
  toSide: 'top' | 'right' | 'bottom' | 'left'
} {
  return {
    fromNode: connection.source,
    toNode: connection.target,
    fromSide: parseSide(connection.sourceHandle),
    toSide: parseSide(connection.targetHandle)
  }
}

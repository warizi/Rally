export type CanvasNodeType =
  | 'text'
  | 'todo'
  | 'note'
  | 'schedule'
  | 'csv'
  | 'pdf'
  | 'image'
  | 'canvas'
export type CanvasEdgeSide = 'top' | 'right' | 'bottom' | 'left'
export type CanvasEdgeStyle = 'solid' | 'dashed' | 'dotted'
export type CanvasEdgeArrow = 'none' | 'end' | 'both'

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
  groupId?: string | null
  x?: number
  y?: number
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

// ─── ReactFlow Node Data Types ──────────────────────────

import type { Node, Edge } from '@xyflow/react'

export type TextNodeData = {
  canvasId: string
  nodeType: 'text'
  content: string | null
  color: string | null
  label: string
  width: number
  height: number
  groupId: string | null
}

export type RefNodeData = {
  canvasId: string
  nodeType: CanvasNodeType
  refId: string | null
  refTitle?: string
  refPreview?: string
  refMeta?: Record<string, unknown>
  content: string | null
  color: string | null
  label: string
  width: number
  height: number
  groupId: string | null
}

export type GroupNodeData = {
  canvasId: string
  nodeType: 'group'
  label: string | null
  color: string | null
  width: number
  height: number
}

// ─── ReactFlow Edge Data Types ──────────────────────────

export type CanvasEdgeData = {
  edgeStyle: CanvasEdgeStyle
  arrow: CanvasEdgeArrow
  color: string | null
  fromSide: CanvasEdgeSide
  toSide: CanvasEdgeSide
}

// ─── Discriminated Union Types ──────────────────────────

export type TextNode = Node<TextNodeData, 'textNode'>
export type RefNode = Node<RefNodeData, 'refNode'>
export type GroupNode = Node<GroupNodeData, 'groupNode'>
// 일반 노드 store 배열 타입. GroupNode 는 렌더 레이어(widgets)에서 별도 관리되며
// ReactFlow nodes 배열에 합류할 때 CanvasFlowNode 로 확장한다.
export type CanvasNode = TextNode | RefNode
export type CanvasFlowNode = TextNode | RefNode | GroupNode
export type CanvasEdge = Edge<CanvasEdgeData>

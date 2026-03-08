export type CanvasNodeType = 'text' | 'todo' | 'note' | 'schedule' | 'csv' | 'pdf' | 'image'
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
  createdAt: Date
  updatedAt: Date
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
  createdAt: Date
  updatedAt: Date
  refTitle?: string
  refPreview?: string
  refMeta?: Record<string, unknown>
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
}

export interface UpdateCanvasNodeData {
  content?: string
  color?: string
  width?: number
  height?: number
  zIndex?: number
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
export type CanvasNode = TextNode | RefNode
export type CanvasEdge = Edge<CanvasEdgeData>

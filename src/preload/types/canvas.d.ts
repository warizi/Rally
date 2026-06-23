import type { IpcResponse, WatcherActor } from './common'

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

export interface CanvasAPI {
  findByWorkspace: (
    workspaceId: string,
    options?: { search?: string }
  ) => Promise<IpcResponse<CanvasItem[]>>
  findById: (canvasId: string) => Promise<IpcResponse<CanvasItem>>
  create: (
    workspaceId: string,
    data: { title: string; description?: string }
  ) => Promise<IpcResponse<CanvasItem>>
  update: (
    canvasId: string,
    data: { title?: string; description?: string }
  ) => Promise<IpcResponse<CanvasItem>>
  updateViewport: (
    canvasId: string,
    viewport: { x: number; y: number; zoom: number }
  ) => Promise<IpcResponse<void>>
  remove: (canvasId: string) => Promise<IpcResponse<void>>
  toggleLock: (canvasId: string, isLocked: boolean) => Promise<IpcResponse<CanvasItem>>
  onChanged: (
    callback: (workspaceId: string, changedRelPaths: string[], actor: WatcherActor | null) => void
  ) => () => void
}

export interface SyncCanvasStateData {
  nodes: {
    id: string
    type: CanvasNodeType
    refId: string | null
    x: number
    y: number
    width: number
    height: number
    color: string | null
    content: string | null
    zIndex: number
    groupId?: string | null
  }[]
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
  }[]
  groups?: {
    id: string
    parentId?: string | null
    label: string | null
    x: number
    y: number
    width: number
    height: number
    color: string | null
  }[]
}

export interface CanvasNodeAPI {
  findByCanvas: (canvasId: string) => Promise<IpcResponse<CanvasNodeItem[]>>
  create: (canvasId: string, data: CreateCanvasNodeData) => Promise<IpcResponse<CanvasNodeItem>>
  update: (nodeId: string, data: UpdateCanvasNodeData) => Promise<IpcResponse<CanvasNodeItem>>
  updatePositions: (updates: { id: string; x: number; y: number }[]) => Promise<IpcResponse<void>>
  remove: (nodeId: string) => Promise<IpcResponse<void>>
  syncState: (canvasId: string, data: SyncCanvasStateData) => Promise<IpcResponse<void>>
}

export interface CanvasEdgeAPI {
  findByCanvas: (canvasId: string) => Promise<IpcResponse<CanvasEdgeItem[]>>
  create: (canvasId: string, data: CreateCanvasEdgeData) => Promise<IpcResponse<CanvasEdgeItem>>
  update: (edgeId: string, data: UpdateCanvasEdgeData) => Promise<IpcResponse<CanvasEdgeItem>>
  remove: (edgeId: string) => Promise<IpcResponse<void>>
}

export interface CanvasGroupAPI {
  findByCanvas: (canvasId: string) => Promise<IpcResponse<CanvasGroupItem[]>>
  create: (canvasId: string, data: CreateCanvasGroupData) => Promise<IpcResponse<CanvasGroupItem>>
  update: (groupId: string, data: UpdateCanvasGroupData) => Promise<IpcResponse<CanvasGroupItem>>
  remove: (groupId: string) => Promise<IpcResponse<void>>
}

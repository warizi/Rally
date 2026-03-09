import type { CanvasNodeType } from '../../../db/schema/canvas-node'
import type { LinkableEntityType } from '../../../db/schema/entity-link'
import type {
  CanvasEdgeSide,
  CanvasEdgeStyle,
  CanvasEdgeArrow
} from '../../../services/canvas-edge'
import type { canvasNodeService } from '../../../services/canvas-node'
import type { canvasEdgeService } from '../../../services/canvas-edge'
import type { noteService } from '../../../services/note'

// ─── Items ──────────────────────────────────────────────────

export interface ListItemsResponse {
  workspace: { id: string; name: string; path: string }
  folders: { id: string; relativePath: string; order: number }[]
  notes: {
    id: string
    title: string
    relativePath: string
    preview: string | null
    folderId: string | null
    folderPath: string | null
    updatedAt: string
  }[]
  tables: {
    id: string
    title: string
    relativePath: string
    description: string | null
    preview: string | null
    folderId: string | null
    folderPath: string | null
    updatedAt: string
  }[]
  canvases: {
    id: string
    title: string
    description: string | null
    createdAt: string
    updatedAt: string
  }[]
  todos: { active: number; completed: number; total: number }
}

export interface ManageItemResult {
  action: string
  type: 'note' | 'table'
  id: string
  success: true
}

export interface RenameItemAction {
  action: 'rename'
  id: string
  newName: string
}

export interface MoveItemAction {
  action: 'move'
  id: string
  targetFolderId?: string
}

export interface DeleteItemAction {
  action: 'delete'
  id: string
}

export type ItemAction = RenameItemAction | MoveItemAction | DeleteItemAction

// ─── Content ────────────────────────────────────────────────

export interface SearchNotesResponse {
  results: Awaited<ReturnType<typeof noteService.search>>
}

export interface NoteContentResponse {
  type: 'note'
  title: string
  relativePath: string
  content: string
}

export interface TableContentResponse {
  type: 'table'
  title: string
  relativePath: string
  content: string
  encoding: string
  columnWidths: string | null
}

export interface WriteContentBody {
  type?: 'note' | 'table'
  id?: string
  title?: string
  folderId?: string
  content: string
}

export interface WriteContentResult {
  type: 'note' | 'table'
  id: string
  title: string
  relativePath: string
  created: boolean
}

// ─── Folders ────────────────────────────────────────────────

export interface ManageFolderResult {
  action: string
  id: string
  success: true
}

export interface CreateFolderAction {
  action: 'create'
  name: string
  parentFolderId?: string
}

export interface RenameFolderAction {
  action: 'rename'
  folderId: string
  newName: string
}

export interface MoveFolderAction {
  action: 'move'
  folderId: string
  parentFolderId?: string
}

export interface DeleteFolderAction {
  action: 'delete'
  folderId: string
}

export type FolderAction =
  | CreateFolderAction
  | RenameFolderAction
  | MoveFolderAction
  | DeleteFolderAction

// ─── Canvases ───────────────────────────────────────────────

export interface CanvasInfo {
  id: string
  title: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface ReadCanvasResponse {
  canvas: CanvasInfo
  nodes: ReturnType<typeof canvasNodeService.findByCanvas>
  edges: ReturnType<typeof canvasEdgeService.findByCanvas>
}

export interface CreatedNodeInfo {
  index: number
  id: string
  type: string
  x: number
  y: number
}

export interface CreateCanvasResponse {
  canvas: { id: string; title: string; description: string | null }
  nodes: CreatedNodeInfo[]
  edges: ReturnType<typeof canvasEdgeService.create>[]
}

export interface CreateCanvasBody {
  title: string
  description?: string
  nodes?: {
    type: CanvasNodeType
    x: number
    y: number
    width?: number
    height?: number
    content?: string
    refId?: string
    color?: string
  }[]
  edges?: {
    fromNodeIndex: number
    toNodeIndex: number
    fromSide?: CanvasEdgeSide
    toSide?: CanvasEdgeSide
    label?: string
    color?: string
    style?: CanvasEdgeStyle
    arrow?: CanvasEdgeArrow
  }[]
}

export interface EditCanvasResult {
  action: string
  success?: true
  tempId?: string
  id?: string
  nodeId?: string
  edgeId?: string
}

export interface UpdateCanvasAction {
  action: 'update'
  title?: string
  description?: string
}

export interface DeleteCanvasAction {
  action: 'delete'
}

export interface AddNodeAction {
  action: 'add_node'
  tempId?: string
  type: CanvasNodeType
  x: number
  y: number
  width?: number
  height?: number
  content?: string
  refId?: string
  color?: string
}

export interface RemoveNodeAction {
  action: 'remove_node'
  nodeId: string
}

export interface AddEdgeAction {
  action: 'add_edge'
  fromNode: string
  toNode: string
  fromSide?: CanvasEdgeSide
  toSide?: CanvasEdgeSide
  label?: string
  color?: string
  style?: CanvasEdgeStyle
  arrow?: CanvasEdgeArrow
}

export interface RemoveEdgeAction {
  action: 'remove_edge'
  edgeId: string
}

export type EditCanvasAction =
  | UpdateCanvasAction
  | DeleteCanvasAction
  | AddNodeAction
  | RemoveNodeAction
  | AddEdgeAction
  | RemoveEdgeAction

// ─── Todos ──────────────────────────────────────────────────

export type TodoStatus = '할일' | '진행중' | '완료' | '보류'
export type TodoPriority = 'high' | 'medium' | 'low'

export interface LinkedItem {
  type: string
  id: string
  title: string | null
}

export interface TodoNode {
  id: string
  parentId: string | null
  title: string
  description: string | null
  status: string
  priority: string
  isDone: boolean
  dueDate: string | null
  startDate: string | null
  createdAt: string
  updatedAt: string
  linkedItems: LinkedItem[]
  children: TodoNode[]
}

export interface ManageTodoResult {
  action: string
  id: string
  success: true
}

export interface LinkRef {
  type: LinkableEntityType
  id: string
}

export interface CreateTodoAction {
  action: 'create'
  title: string
  description?: string
  status?: TodoStatus
  priority?: TodoPriority
  dueDate?: string
  startDate?: string
  subtodos?: { title: string }[]
  linkItems?: LinkRef[]
}

export interface UpdateTodoAction {
  action: 'update'
  id: string
  title?: string
  description?: string
  status?: TodoStatus
  priority?: TodoPriority
  isDone?: boolean
  dueDate?: string | null
  startDate?: string | null
  linkItems?: LinkRef[]
  unlinkItems?: LinkRef[]
}

export interface DeleteTodoAction {
  action: 'delete'
  id: string
}

export type TodoAction = CreateTodoAction | UpdateTodoAction | DeleteTodoAction

// ─── Links ──────────────────────────────────────────────────

export interface LinkItemAction {
  action: 'link'
  sourceType: LinkableEntityType
  sourceId: string
  targetType: LinkableEntityType
  targetId: string
}

export interface UnlinkItemAction {
  action: 'unlink'
  sourceType: LinkableEntityType
  sourceId: string
  targetType: LinkableEntityType
  targetId: string
}

export interface ListLinksAction {
  action: 'list'
  entityType: LinkableEntityType
  entityId: string
}

export type LinkAction = LinkItemAction | UnlinkItemAction | ListLinksAction

export interface ManageLinkResult {
  action: string
  sourceType?: LinkableEntityType
  sourceId?: string
  targetType?: LinkableEntityType
  targetId?: string
  entityType?: LinkableEntityType
  entityId?: string
  success: true
  linkedItems?: LinkedItem[]
}

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
// list_items 응답 타입은 services/workspace-items.ts의 ListWorkspaceItemsResult 사용

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
  /** resolveLinks=true 시 채워짐. note/csv/pdf/image는 preview, canvas/todo/schedule은 description. */
  preview?: string | null
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

// ─── Schedules ──────────────────────────────────────────────

export interface ScheduleSummary {
  id: string
  workspaceId: string | null
  title: string
  description: string | null
  location: string | null
  allDay: boolean
  startAt: string
  endAt: string
  color: string | null
  priority: 'low' | 'medium' | 'high'
  createdAt: string
  updatedAt: string
}

export interface CreateScheduleAction {
  action: 'create'
  title: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt: string
  endAt: string
  color?: string | null
  priority?: 'low' | 'medium' | 'high'
}

export interface UpdateScheduleAction {
  action: 'update'
  id: string
  title?: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt?: string
  endAt?: string
  color?: string | null
  priority?: 'low' | 'medium' | 'high'
}

export interface DeleteScheduleAction {
  action: 'delete'
  id: string
}

export type ScheduleAction = CreateScheduleAction | UpdateScheduleAction | DeleteScheduleAction

export interface ManageScheduleResult {
  action: string
  id: string
  success: true
}

// ─── Reminders ──────────────────────────────────────────────

export interface ReminderSummary {
  id: string
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
  remindAt: string
  isFired: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateReminderAction {
  action: 'create'
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
}

export interface DeleteReminderAction {
  action: 'delete'
  id: string
}

export type ReminderAction = CreateReminderAction | DeleteReminderAction

export interface ManageReminderResult {
  action: string
  id: string
  success: true
}

// ─── Recurring Rules / Completions ──────────────────────────

export type RecurrenceType = 'daily' | 'weekday' | 'weekend' | 'custom'

export interface RecurringRuleSummary {
  id: string
  workspaceId: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  recurrenceType: RecurrenceType
  daysOfWeek: number[] | null
  startDate: string
  endDate: string | null
  startTime: string | null
  endTime: string | null
  reminderOffsetMs: number | null
  createdAt: string
  updatedAt: string
}

export interface CreateRecurringRuleAction {
  action: 'create'
  title: string
  description?: string
  priority?: 'high' | 'medium' | 'low'
  recurrenceType: RecurrenceType
  daysOfWeek?: number[]
  startDate: string
  endDate?: string | null
  startTime?: string | null
  endTime?: string | null
  reminderOffsetMs?: number | null
}

export interface UpdateRecurringRuleAction {
  action: 'update'
  id: string
  title?: string
  description?: string
  priority?: 'high' | 'medium' | 'low'
  recurrenceType?: RecurrenceType
  daysOfWeek?: number[] | null
  startDate?: string
  endDate?: string | null
  startTime?: string | null
  endTime?: string | null
  reminderOffsetMs?: number | null
}

export interface DeleteRecurringRuleAction {
  action: 'delete'
  id: string
}

export type RecurringRuleAction =
  | CreateRecurringRuleAction
  | UpdateRecurringRuleAction
  | DeleteRecurringRuleAction

export interface ManageRecurringRuleResult {
  action: string
  id: string
  success: true
}

export interface RecurringCompletionSummary {
  id: string
  ruleId: string | null
  ruleTitle: string
  workspaceId: string
  completedDate: string
  completedAt: string
  createdAt: string
}

// ─── Templates ──────────────────────────────────────────────

export type TemplateType = 'note' | 'csv'

export interface TemplateSummary {
  id: string
  workspaceId: string
  title: string
  type: TemplateType
  createdAt: string
}

export interface TemplateDetail extends TemplateSummary {
  jsonData: string
}

export interface CreateTemplateAction {
  action: 'create'
  title: string
  type: TemplateType
  jsonData: string
}

export interface DeleteTemplateAction {
  action: 'delete'
  id: string
}

export type TemplateAction = CreateTemplateAction | DeleteTemplateAction

export interface ManageTemplateResult {
  action: string
  id: string
  success: true
}

// ─── Tags / Item-Tags ───────────────────────────────────────

import type { TaggableEntityType } from '../../../db/schema/tag'

export interface TagSummary {
  id: string
  workspaceId: string
  name: string
  color: string
  description: string | null
  createdAt: string
}

export interface TaggedItemSummary {
  type: TaggableEntityType
  id: string
  title: string
}

export interface CreateTagAction {
  action: 'create_tag'
  name: string
  color?: string
  description?: string
}

export interface UpdateTagAction {
  action: 'update_tag'
  id: string
  name?: string
  color?: string
  description?: string | null
}

export interface DeleteTagAction {
  action: 'delete_tag'
  id: string
}

export interface AttachTagAction {
  action: 'attach'
  tagId: string
  itemType: TaggableEntityType
  itemId: string
}

export interface DetachTagAction {
  action: 'detach'
  tagId: string
  itemType: TaggableEntityType
  itemId: string
}

export type TagAction =
  | CreateTagAction
  | UpdateTagAction
  | DeleteTagAction
  | AttachTagAction
  | DetachTagAction

export interface ManageTagResult {
  action: string
  id: string
  success: true
}

// ─── Files (PDF / Image 공통) ───────────────────────────────

export interface FileSummary {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: string
  updatedAt: string
}

export interface RenameFileAction {
  action: 'rename'
  id: string
  newName: string
}

export interface MoveFileAction {
  action: 'move'
  id: string
  targetFolderId?: string
}

export interface UpdateFileMetaAction {
  action: 'update_meta'
  id: string
  description?: string
}

export interface DeleteFileAction {
  action: 'delete'
  id: string
}

export type FileAction = RenameFileAction | MoveFileAction | UpdateFileMetaAction | DeleteFileAction

export interface ManageFileResult {
  action: string
  id: string
  success: true
}

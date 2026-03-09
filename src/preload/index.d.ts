import { ElectronAPI } from '@electron-toolkit/preload'
import type { Workspace } from '../main/repositories/workspace'
import type { TabSession, TabSessionInsert } from '../main/repositories/tab-session'
import type { TabSnapshot } from '../main/repositories/tab-snapshot'
import type { IpcResponse } from '../main/lib/ipc-response'

interface TabSessionAPI {
  getByWorkspaceId: (workspaceId: string) => Promise<IpcResponse<TabSession>>
  upsert: (data: Omit<TabSessionInsert, 'updatedAt'>) => Promise<IpcResponse<TabSession>>
}

interface TabSnapshotAPI {
  getByWorkspaceId: (workspaceId: string) => Promise<IpcResponse<TabSnapshot[]>>
  create: (data: {
    name: string
    description?: string
    workspaceId: string
    tabsJson: string
    panesJson: string
    layoutJson: string
  }) => Promise<IpcResponse<TabSnapshot>>
  update: (
    id: string,
    data: {
      name?: string
      description?: string
      tabsJson?: string
      panesJson?: string
      layoutJson?: string
    }
  ) => Promise<IpcResponse<TabSnapshot>>
  delete: (id: string) => Promise<IpcResponse<void>>
}

interface NoteNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

interface NoteAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<NoteNode[]>>
  create: (
    workspaceId: string,
    folderId: string | null,
    name: string
  ) => Promise<IpcResponse<NoteNode>>
  rename: (workspaceId: string, noteId: string, newName: string) => Promise<IpcResponse<NoteNode>>
  remove: (workspaceId: string, noteId: string) => Promise<IpcResponse<void>>
  readContent: (workspaceId: string, noteId: string) => Promise<IpcResponse<string>>
  writeContent: (workspaceId: string, noteId: string, content: string) => Promise<IpcResponse<void>>
  move: (
    workspaceId: string,
    noteId: string,
    folderId: string | null,
    index: number
  ) => Promise<IpcResponse<NoteNode>>
  updateMeta: (
    workspaceId: string,
    noteId: string,
    data: { description?: string }
  ) => Promise<IpcResponse<NoteNode>>
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}

interface CsvFileNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  columnWidths: string | null
  folderId: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

interface CsvAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<CsvFileNode[]>>
  create: (
    workspaceId: string,
    folderId: string | null,
    name: string
  ) => Promise<IpcResponse<CsvFileNode>>
  rename: (workspaceId: string, csvId: string, newName: string) => Promise<IpcResponse<CsvFileNode>>
  remove: (workspaceId: string, csvId: string) => Promise<IpcResponse<void>>
  readContent: (
    workspaceId: string,
    csvId: string
  ) => Promise<IpcResponse<{ content: string; encoding: string; columnWidths: string | null }>>
  writeContent: (workspaceId: string, csvId: string, content: string) => Promise<IpcResponse<void>>
  move: (
    workspaceId: string,
    csvId: string,
    folderId: string | null,
    index: number
  ) => Promise<IpcResponse<CsvFileNode>>
  updateMeta: (
    workspaceId: string,
    csvId: string,
    data: { description?: string; columnWidths?: string }
  ) => Promise<IpcResponse<CsvFileNode>>
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}

interface PdfFileNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

interface PdfAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<PdfFileNode[]>>
  import: (
    workspaceId: string,
    folderId: string | null,
    sourcePath: string
  ) => Promise<IpcResponse<PdfFileNode>>
  rename: (workspaceId: string, pdfId: string, newName: string) => Promise<IpcResponse<PdfFileNode>>
  remove: (workspaceId: string, pdfId: string) => Promise<IpcResponse<void>>
  readContent: (workspaceId: string, pdfId: string) => Promise<IpcResponse<{ data: ArrayBuffer }>>
  move: (
    workspaceId: string,
    pdfId: string,
    folderId: string | null,
    index: number
  ) => Promise<IpcResponse<PdfFileNode>>
  updateMeta: (
    workspaceId: string,
    pdfId: string,
    data: { description?: string }
  ) => Promise<IpcResponse<PdfFileNode>>
  selectFile: () => Promise<string | null>
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}

interface ImageFileNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

interface ImageAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<ImageFileNode[]>>
  import: (
    workspaceId: string,
    folderId: string | null,
    sourcePath: string
  ) => Promise<IpcResponse<ImageFileNode>>
  rename: (
    workspaceId: string,
    imageId: string,
    newName: string
  ) => Promise<IpcResponse<ImageFileNode>>
  remove: (workspaceId: string, imageId: string) => Promise<IpcResponse<void>>
  readContent: (workspaceId: string, imageId: string) => Promise<IpcResponse<{ data: ArrayBuffer }>>
  move: (
    workspaceId: string,
    imageId: string,
    folderId: string | null,
    index: number
  ) => Promise<IpcResponse<ImageFileNode>>
  updateMeta: (
    workspaceId: string,
    imageId: string,
    data: { description?: string }
  ) => Promise<IpcResponse<ImageFileNode>>
  selectFile: () => Promise<string[] | null>
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}

interface NoteImageAPI {
  saveFromPath: (workspaceId: string, sourcePath: string) => Promise<IpcResponse<string>>
  saveFromBuffer: (
    workspaceId: string,
    buffer: ArrayBuffer,
    ext: string
  ) => Promise<IpcResponse<string>>
  readImage: (
    workspaceId: string,
    relativePath: string
  ) => Promise<IpcResponse<{ data: ArrayBuffer }>>
}

interface FolderNode {
  id: string
  name: string
  relativePath: string
  color: string | null
  order: number
  children: FolderNode[]
}

interface FolderAPI {
  readTree: (workspaceId: string) => Promise<IpcResponse<FolderNode[]>>
  create: (
    workspaceId: string,
    parentFolderId: string | null,
    name: string
  ) => Promise<IpcResponse<FolderNode>>
  rename: (
    workspaceId: string,
    folderId: string,
    newName: string
  ) => Promise<IpcResponse<FolderNode>>
  remove: (workspaceId: string, folderId: string) => Promise<IpcResponse<void>>
  move: (
    workspaceId: string,
    folderId: string,
    parentFolderId: string | null,
    index: number
  ) => Promise<IpcResponse<FolderNode>>
  updateMeta: (
    workspaceId: string,
    folderId: string,
    data: { color?: string | null; order?: number }
  ) => Promise<IpcResponse<FolderNode>>
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}

interface WorkspaceAPI {
  getAll: () => Promise<IpcResponse<Workspace[]>>
  getById: (id: string) => Promise<IpcResponse<Workspace>>
  create: (name: string, path: string) => Promise<IpcResponse<Workspace>>
  update: (
    id: string,
    data: Partial<Pick<Workspace, 'name' | 'path' | 'updatedAt'>>
  ) => Promise<IpcResponse<Workspace>>
  delete: (id: string) => Promise<IpcResponse<void>>
  activate: (id: string) => Promise<IpcResponse<Workspace>>
  selectDirectory: () => Promise<string | null>
}

interface TodoItem {
  id: string
  workspaceId: string
  parentId: string | null
  title: string
  description: string
  status: '할일' | '진행중' | '완료' | '보류'
  priority: 'high' | 'medium' | 'low'
  isDone: boolean
  listOrder: number
  kanbanOrder: number
  subOrder: number
  createdAt: Date
  updatedAt: Date
  doneAt: Date | null
  dueDate: Date | null
  startDate: Date | null
}

interface CreateTodoData {
  title: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
  parentId?: string | null
  dueDate?: Date | null
  startDate?: Date | null
}

interface UpdateTodoData {
  title?: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
  isDone?: boolean
  dueDate?: Date | null
  startDate?: Date | null
}

interface TodoOrderUpdate {
  id: string
  order: number
  status?: '할일' | '진행중' | '완료' | '보류'
}

type TodoFindFilter = 'all' | 'active' | 'completed'

interface TodoAPI {
  findByWorkspace: (
    workspaceId: string,
    options?: { filter?: TodoFindFilter }
  ) => Promise<IpcResponse<TodoItem[]>>
  findByDateRange: (
    workspaceId: string,
    range: { start: Date; end: Date }
  ) => Promise<IpcResponse<TodoItem[]>>
  create: (workspaceId: string, data: CreateTodoData) => Promise<IpcResponse<TodoItem>>
  update: (todoId: string, data: UpdateTodoData) => Promise<IpcResponse<TodoItem>>
  remove: (todoId: string) => Promise<IpcResponse<void>>
  reorderList: (workspaceId: string, updates: TodoOrderUpdate[]) => Promise<IpcResponse<void>>
  reorderKanban: (workspaceId: string, updates: TodoOrderUpdate[]) => Promise<IpcResponse<void>>
  reorderSub: (parentId: string, updates: TodoOrderUpdate[]) => Promise<IpcResponse<void>>
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}

interface SettingsAPI {
  get: (key: string) => Promise<IpcResponse<string | null>>
  set: (key: string, value: string) => Promise<IpcResponse<void>>
}

interface ScheduleItem {
  id: string
  workspaceId: string | null
  title: string
  description: string | null
  location: string | null
  allDay: boolean
  startAt: Date
  endAt: Date
  color: string | null
  priority: 'low' | 'medium' | 'high'
  createdAt: Date
  updatedAt: Date
}

interface CreateScheduleData {
  title: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt: Date
  endAt: Date
  color?: string | null
  priority?: 'low' | 'medium' | 'high'
}

interface UpdateScheduleData {
  title?: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt?: Date
  endAt?: Date
  color?: string | null
  priority?: 'low' | 'medium' | 'high'
}

interface ScheduleDateRange {
  start: Date
  end: Date
}

type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv' | 'image' | 'canvas'

interface LinkedEntity {
  entityType: LinkableEntityType
  entityId: string
  title: string
  linkedAt: Date
}

interface EntityLinkAPI {
  link: (
    typeA: LinkableEntityType,
    idA: string,
    typeB: LinkableEntityType,
    idB: string,
    workspaceId: string
  ) => Promise<IpcResponse<void>>
  unlink: (
    typeA: LinkableEntityType,
    idA: string,
    typeB: LinkableEntityType,
    idB: string
  ) => Promise<IpcResponse<void>>
  getLinked: (
    entityType: LinkableEntityType,
    entityId: string
  ) => Promise<IpcResponse<LinkedEntity[]>>
  onChanged: (callback: () => void) => () => void
}

type CanvasNodeType = 'text' | 'todo' | 'note' | 'schedule' | 'csv' | 'pdf' | 'image'
type CanvasEdgeSide = 'top' | 'right' | 'bottom' | 'left'
type CanvasEdgeStyle = 'solid' | 'dashed' | 'dotted'
type CanvasEdgeArrow = 'none' | 'end' | 'both'

interface CanvasItem {
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

interface CanvasNodeItem {
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

interface CanvasEdgeItem {
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

interface CreateCanvasNodeData {
  type: CanvasNodeType
  refId?: string
  x: number
  y: number
  width?: number
  height?: number
  color?: string
  content?: string
}

interface UpdateCanvasNodeData {
  content?: string
  color?: string
  width?: number
  height?: number
  zIndex?: number
}

interface CreateCanvasEdgeData {
  fromNode: string
  toNode: string
  fromSide?: CanvasEdgeSide
  toSide?: CanvasEdgeSide
  label?: string
  color?: string
  style?: CanvasEdgeStyle
  arrow?: CanvasEdgeArrow
}

interface UpdateCanvasEdgeData {
  fromSide?: CanvasEdgeSide
  toSide?: CanvasEdgeSide
  label?: string
  color?: string
  style?: CanvasEdgeStyle
  arrow?: CanvasEdgeArrow
}

interface CanvasAPI {
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
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}

interface SyncCanvasStateData {
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
}

interface CanvasNodeAPI {
  findByCanvas: (canvasId: string) => Promise<IpcResponse<CanvasNodeItem[]>>
  create: (canvasId: string, data: CreateCanvasNodeData) => Promise<IpcResponse<CanvasNodeItem>>
  update: (nodeId: string, data: UpdateCanvasNodeData) => Promise<IpcResponse<CanvasNodeItem>>
  updatePositions: (updates: { id: string; x: number; y: number }[]) => Promise<IpcResponse<void>>
  remove: (nodeId: string) => Promise<IpcResponse<void>>
  syncState: (canvasId: string, data: SyncCanvasStateData) => Promise<IpcResponse<void>>
}

interface CanvasEdgeAPI {
  findByCanvas: (canvasId: string) => Promise<IpcResponse<CanvasEdgeItem[]>>
  create: (canvasId: string, data: CreateCanvasEdgeData) => Promise<IpcResponse<CanvasEdgeItem>>
  update: (edgeId: string, data: UpdateCanvasEdgeData) => Promise<IpcResponse<CanvasEdgeItem>>
  remove: (edgeId: string) => Promise<IpcResponse<void>>
}

interface ScheduleAPI {
  findAllByWorkspace: (workspaceId: string) => Promise<IpcResponse<ScheduleItem[]>>
  findByWorkspace: (
    workspaceId: string,
    range: ScheduleDateRange
  ) => Promise<IpcResponse<ScheduleItem[]>>
  findById: (scheduleId: string) => Promise<IpcResponse<ScheduleItem>>
  create: (workspaceId: string, data: CreateScheduleData) => Promise<IpcResponse<ScheduleItem>>
  update: (scheduleId: string, data: UpdateScheduleData) => Promise<IpcResponse<ScheduleItem>>
  remove: (scheduleId: string) => Promise<IpcResponse<void>>
  move: (scheduleId: string, startAt: Date, endAt: Date) => Promise<IpcResponse<ScheduleItem>>
  linkTodo: (scheduleId: string, todoId: string) => Promise<IpcResponse<void>>
  unlinkTodo: (scheduleId: string, todoId: string) => Promise<IpcResponse<void>>
  getLinkedTodos: (scheduleId: string) => Promise<IpcResponse<TodoItem[]>>
}

interface ReminderItem {
  id: string
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
  remindAt: Date
  isFired: boolean
  createdAt: Date
  updatedAt: Date
}

interface SetReminderData {
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
}

interface ReminderAPI {
  findByEntity: (
    entityType: 'todo' | 'schedule',
    entityId: string
  ) => Promise<IpcResponse<ReminderItem[]>>
  set: (data: SetReminderData) => Promise<IpcResponse<ReminderItem>>
  remove: (reminderId: string) => Promise<IpcResponse<void>>
  removeByEntity: (entityType: 'todo' | 'schedule', entityId: string) => Promise<IpcResponse<void>>
  onFired: (
    callback: (data: {
      entityType: string
      entityId: string
      title: string
      workspaceId: string | null
    }) => void
  ) => () => void
}

type TaggableEntityType = 'note' | 'todo' | 'image' | 'pdf' | 'csv' | 'canvas' | 'folder'

interface TagItem {
  id: string
  workspaceId: string
  name: string
  color: string
  description: string | null
  createdAt: Date
}

interface CreateTagInput {
  name: string
  color: string
  description?: string
}

interface UpdateTagInput {
  name?: string
  color?: string
  description?: string | null
}

interface TagAPI {
  getAll: (workspaceId: string) => Promise<IpcResponse<TagItem[]>>
  create: (workspaceId: string, input: CreateTagInput) => Promise<IpcResponse<TagItem>>
  update: (id: string, input: UpdateTagInput) => Promise<IpcResponse<TagItem>>
  remove: (id: string) => Promise<IpcResponse<void>>
}

interface ItemTagAPI {
  getTagsByItem: (itemType: TaggableEntityType, itemId: string) => Promise<IpcResponse<TagItem[]>>
  getItemIdsByTag: (tagId: string, itemType: TaggableEntityType) => Promise<IpcResponse<string[]>>
  attach: (
    itemType: TaggableEntityType,
    tagId: string,
    itemId: string
  ) => Promise<IpcResponse<void>>
  detach: (
    itemType: TaggableEntityType,
    tagId: string,
    itemId: string
  ) => Promise<IpcResponse<void>>
}

interface TerminalAPI {
  create: (args: { cwd: string; cols: number; rows: number }) => Promise<IpcResponse<void>>
  destroy: () => Promise<IpcResponse<void>>
  write: (args: { data: string }) => void
  resize: (args: { cols: number; rows: number }) => void
  onData: (callback: (data: { data: string }) => void) => () => void
  onExit: (callback: (data: { exitCode: number }) => void) => () => void
}

interface CommandFile {
  name: string
  content: string
}

interface AppInfoAPI {
  getVersion: () => Promise<IpcResponse<string>>
  getMcpServerPath: () => Promise<IpcResponse<string>>
  getCommandFiles: () => Promise<IpcResponse<CommandFile[]>>
}

interface BackupManifest {
  version: number
  appVersion: string
  workspaceName: string
  exportedAt: string
  tables: string[]
}

interface BackupAPI {
  export: (workspaceId: string) => Promise<IpcResponse<null>>
  selectFile: () => Promise<string | null>
  readManifest: (zipPath: string) => Promise<IpcResponse<BackupManifest>>
  import: (zipPath: string, name: string, path: string) => Promise<IpcResponse<Workspace>>
}

interface API {
  note: NoteAPI
  csv: CsvAPI
  pdf: PdfAPI
  image: ImageAPI
  noteImage: NoteImageAPI
  folder: FolderAPI
  tabSession: TabSessionAPI
  tabSnapshot: TabSnapshotAPI
  workspace: WorkspaceAPI
  todo: TodoAPI
  settings: SettingsAPI
  schedule: ScheduleAPI
  entityLink: EntityLinkAPI
  canvas: CanvasAPI
  canvasNode: CanvasNodeAPI
  canvasEdge: CanvasEdgeAPI
  reminder: ReminderAPI
  tag: TagAPI
  itemTag: ItemTagAPI
  backup: BackupAPI
  appInfo: AppInfoAPI
  terminal: TerminalAPI
}

interface ShellAPI {
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
    shell: ShellAPI
  }
}

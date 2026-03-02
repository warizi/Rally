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
  rename: (
    workspaceId: string,
    csvId: string,
    newName: string
  ) => Promise<IpcResponse<CsvFileNode>>
  remove: (workspaceId: string, csvId: string) => Promise<IpcResponse<void>>
  readContent: (
    workspaceId: string,
    csvId: string
  ) => Promise<IpcResponse<{ content: string; encoding: string; columnWidths: string | null }>>
  writeContent: (
    workspaceId: string,
    csvId: string,
    content: string
  ) => Promise<IpcResponse<void>>
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
  rename: (
    workspaceId: string,
    pdfId: string,
    newName: string
  ) => Promise<IpcResponse<PdfFileNode>>
  remove: (workspaceId: string, pdfId: string) => Promise<IpcResponse<void>>
  readContent: (
    workspaceId: string,
    pdfId: string
  ) => Promise<IpcResponse<{ data: ArrayBuffer }>>
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
  readContent: (
    workspaceId: string,
    imageId: string
  ) => Promise<IpcResponse<{ data: ArrayBuffer }>>
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
  create: (workspaceId: string, data: CreateTodoData) => Promise<IpcResponse<TodoItem>>
  update: (todoId: string, data: UpdateTodoData) => Promise<IpcResponse<TodoItem>>
  remove: (todoId: string) => Promise<IpcResponse<void>>
  reorderList: (workspaceId: string, updates: TodoOrderUpdate[]) => Promise<IpcResponse<void>>
  reorderKanban: (workspaceId: string, updates: TodoOrderUpdate[]) => Promise<IpcResponse<void>>
  reorderSub: (parentId: string, updates: TodoOrderUpdate[]) => Promise<IpcResponse<void>>
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

type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv' | 'image'

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
}

interface ScheduleAPI {
  findAllByWorkspace: (workspaceId: string) => Promise<IpcResponse<ScheduleItem[]>>
  findByWorkspace: (
    workspaceId: string,
    range: ScheduleDateRange
  ) => Promise<IpcResponse<ScheduleItem[]>>
  findById: (scheduleId: string) => Promise<IpcResponse<ScheduleItem>>
  create: (
    workspaceId: string,
    data: CreateScheduleData
  ) => Promise<IpcResponse<ScheduleItem>>
  update: (
    scheduleId: string,
    data: UpdateScheduleData
  ) => Promise<IpcResponse<ScheduleItem>>
  remove: (scheduleId: string) => Promise<IpcResponse<void>>
  move: (
    scheduleId: string,
    startAt: Date,
    endAt: Date
  ) => Promise<IpcResponse<ScheduleItem>>
  linkTodo: (scheduleId: string, todoId: string) => Promise<IpcResponse<void>>
  unlinkTodo: (scheduleId: string, todoId: string) => Promise<IpcResponse<void>>
  getLinkedTodos: (scheduleId: string) => Promise<IpcResponse<TodoItem[]>>
}

interface API {
  note: NoteAPI
  csv: CsvAPI
  pdf: PdfAPI
  image: ImageAPI
  folder: FolderAPI
  tabSession: TabSessionAPI
  tabSnapshot: TabSnapshotAPI
  workspace: WorkspaceAPI
  todo: TodoAPI
  settings: SettingsAPI
  schedule: ScheduleAPI
  entityLink: EntityLinkAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}

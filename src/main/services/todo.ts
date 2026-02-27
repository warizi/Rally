import { nanoid } from 'nanoid'
import { NotFoundError } from '../lib/errors'
import { todoRepository } from '../repositories/todo'
import { workspaceRepository } from '../repositories/workspace'

export interface TodoItem {
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
}

export interface CreateTodoData {
  title: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
  parentId?: string | null
  dueDate?: Date | null
}

export interface UpdateTodoData {
  title?: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
  isDone?: boolean
  dueDate?: Date | null
}

export interface TodoOrderUpdate {
  id: string
  order: number
  status?: '할일' | '진행중' | '완료' | '보류' // reorderKanban 전용
}

function toTodoItem(todo: ReturnType<typeof todoRepository.findById>): TodoItem {
  if (!todo) throw new Error('todo is undefined')
  return {
    id: todo.id,
    workspaceId: todo.workspaceId,
    parentId: todo.parentId ?? null,
    title: todo.title,
    description: todo.description,
    status: todo.status as TodoItem['status'],
    priority: todo.priority as TodoItem['priority'],
    isDone: todo.isDone,
    listOrder: todo.listOrder,
    kanbanOrder: todo.kanbanOrder,
    subOrder: todo.subOrder,
    createdAt: todo.createdAt instanceof Date ? todo.createdAt : new Date(todo.createdAt as number),
    updatedAt: todo.updatedAt instanceof Date ? todo.updatedAt : new Date(todo.updatedAt as number),
    doneAt: todo.doneAt
      ? todo.doneAt instanceof Date
        ? todo.doneAt
        : new Date(todo.doneAt as number)
      : null,
    dueDate: todo.dueDate
      ? todo.dueDate instanceof Date
        ? todo.dueDate
        : new Date(todo.dueDate as number)
      : null
  }
}

/**
 * isDone ↔ status ↔ doneAt 동기화
 * isDone 또는 status 중 하나가 변경되면 나머지를 동기화
 */
function resolveDoneFields(
  data: UpdateTodoData,
  now: number
): { isDone?: boolean; status?: TodoItem['status']; doneAt?: Date | null } {
  const result: { isDone?: boolean; status?: TodoItem['status']; doneAt?: Date | null } = {}

  if (data.isDone !== undefined) {
    result.isDone = data.isDone
    result.status = data.isDone ? '완료' : '할일'
    result.doneAt = data.isDone ? new Date(now) : null
  } else if (data.status !== undefined) {
    result.status = data.status
    result.isDone = data.status === '완료'
    result.doneAt = data.status === '완료' ? new Date(now) : null
  }

  return result
}

export const todoService = {
  findByWorkspace(workspaceId: string, filter?: 'all' | 'active' | 'completed'): TodoItem[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    return todoRepository.findByWorkspaceId(workspaceId, filter).map(toTodoItem)
  },

  create(workspaceId: string, data: CreateTodoData): TodoItem {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    // parentId 유효성 검사
    if (data.parentId) {
      const parent = todoRepository.findById(data.parentId)
      if (!parent) throw new NotFoundError(`Parent todo not found: ${data.parentId}`)
    }

    const now = new Date()

    // order: 같은 레벨(workspaceId + parentId) 내 max + 1
    const siblings = data.parentId
      ? todoRepository.findByParentId(data.parentId)
      : todoRepository.findTopLevelByWorkspaceId(workspaceId)

    const maxListOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.listOrder)) : -1
    const maxKanbanOrder =
      siblings.length > 0 ? Math.max(...siblings.map((s) => s.kanbanOrder)) : -1
    const maxSubOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.subOrder)) : -1

    const status = data.status ?? '할일'
    const isDone = status === '완료'

    const row = todoRepository.create({
      id: nanoid(),
      workspaceId,
      parentId: data.parentId ?? null,
      title: data.title.trim(),
      description: data.description?.trim() ?? '',
      status,
      priority: data.priority ?? 'medium',
      isDone,
      listOrder: maxListOrder + 1,
      kanbanOrder: maxKanbanOrder + 1,
      subOrder: maxSubOrder + 1,
      createdAt: now,
      updatedAt: now,
      doneAt: isDone ? now : null,
      dueDate: data.dueDate ?? null
    })

    return toTodoItem(row)
  },

  update(todoId: string, data: UpdateTodoData): TodoItem {
    const todo = todoRepository.findById(todoId)
    if (!todo) throw new NotFoundError(`Todo not found: ${todoId}`)

    const now = Date.now()
    const doneFields = resolveDoneFields(data, now)

    const updated = todoRepository.update(todoId, {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...doneFields,
      updatedAt: new Date(now)
    })

    if (!updated) throw new NotFoundError(`Todo not found: ${todoId}`)

    // 자동완료 (단방향): 하위 전체 완료 → 부모 자동완료
    // 역방향(하위 미완료 → 부모 복원)은 없음
    if (doneFields.isDone === true && todo.parentId) {
      const siblings = todoRepository.findByParentId(todo.parentId)
      const allDone = siblings.every((s) => (s.id === todoId ? true : s.isDone))
      if (allDone) {
        const parentNow = Date.now()
        todoRepository.update(todo.parentId, {
          isDone: true,
          status: '완료',
          doneAt: new Date(parentNow),
          updatedAt: new Date(parentNow)
        })
      }
    }

    return toTodoItem(updated)
  },

  remove(todoId: string): void {
    const todo = todoRepository.findById(todoId)
    if (!todo) throw new NotFoundError(`Todo not found: ${todoId}`)
    todoRepository.delete(todoId)
  },

  reorderList(workspaceId: string, updates: TodoOrderUpdate[]): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    todoRepository.bulkUpdateListOrder(updates.map((u) => ({ id: u.id, order: u.order })))
  },

  reorderKanban(workspaceId: string, updates: TodoOrderUpdate[]): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    const now = Date.now()
    todoRepository.bulkUpdateKanbanOrder(
      updates.map((u) => {
        if (u.status !== undefined) {
          // 보드 간 이동: isDone/doneAt을 status와 동기화
          return {
            id: u.id,
            order: u.order,
            status: u.status,
            isDone: u.status === '완료',
            doneAt: u.status === '완료' ? now : null
          }
        }
        return { id: u.id, order: u.order }
      })
    )
  },

  reorderSub(parentId: string, updates: TodoOrderUpdate[]): void {
    const parent = todoRepository.findById(parentId)
    if (!parent) throw new NotFoundError(`Parent todo not found: ${parentId}`)
    todoRepository.bulkUpdateSubOrder(updates.map((u) => ({ id: u.id, order: u.order })))
  }
}

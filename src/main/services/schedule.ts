import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { scheduleRepository } from '../repositories/schedule'
import { scheduleTodoRepository } from '../repositories/schedule-todo'
import { workspaceRepository } from '../repositories/workspace'
import { todoRepository } from '../repositories/todo'
import type { Schedule } from '../repositories/schedule'
import type { Todo } from '../repositories/todo'

// === Domain Types ===

export interface ScheduleItem {
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

export interface CreateScheduleData {
  title: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt: Date
  endAt: Date
  color?: string | null
  priority?: 'low' | 'medium' | 'high'
}

export interface UpdateScheduleData {
  title?: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt?: Date
  endAt?: Date
  color?: string | null
  priority?: 'low' | 'medium' | 'high'
}

export interface ScheduleDateRange {
  start: Date
  end: Date
}

// === TodoItem (schedule 전용 mapper) ===

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
  startDate: Date | null
}

// === Mappers ===

function toScheduleItem(row: Schedule): ScheduleItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    description: row.description,
    location: row.location,
    allDay: row.allDay,
    startAt: row.startAt instanceof Date ? row.startAt : new Date(row.startAt as number),
    endAt: row.endAt instanceof Date ? row.endAt : new Date(row.endAt as number),
    color: row.color,
    priority: row.priority as ScheduleItem['priority'],
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as number),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as number),
  }
}

function toTodoItem(todo: Todo): TodoItem {
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
      : null,
    startDate: todo.startDate
      ? todo.startDate instanceof Date
        ? todo.startDate
        : new Date(todo.startDate as number)
      : null,
  }
}

// === Service ===

export const scheduleService = {
  findByWorkspace(workspaceId: string, range: ScheduleDateRange): ScheduleItem[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError('워크스페이스를 찾을 수 없습니다')

    const rows = scheduleRepository.findByWorkspaceId(workspaceId, range.start, range.end)
    return rows.map(toScheduleItem)
  },

  findById(scheduleId: string): ScheduleItem {
    const row = scheduleRepository.findById(scheduleId)
    if (!row) throw new NotFoundError('일정을 찾을 수 없습니다')
    return toScheduleItem(row)
  },

  create(workspaceId: string, data: CreateScheduleData): ScheduleItem {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError('워크스페이스를 찾을 수 없습니다')

    if (!data.title.trim()) throw new ValidationError('제목을 입력해주세요')

    if (data.startAt > data.endAt) {
      throw new ValidationError('시작 시간이 종료 시간보다 늦을 수 없습니다')
    }

    const now = new Date()
    let startAt = data.startAt
    let endAt = data.endAt

    if (data.allDay) {
      startAt = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate(), 0, 0, 0, 0)
      endAt = new Date(endAt.getFullYear(), endAt.getMonth(), endAt.getDate(), 23, 59, 59, 999)
    }

    const row = scheduleRepository.create({
      id: nanoid(),
      workspaceId,
      title: data.title.trim(),
      description: data.description ?? null,
      location: data.location ?? null,
      allDay: data.allDay ?? false,
      startAt,
      endAt,
      color: data.color ?? null,
      priority: data.priority ?? 'medium',
      createdAt: now,
      updatedAt: now,
    })

    return toScheduleItem(row)
  },

  update(scheduleId: string, data: UpdateScheduleData): ScheduleItem {
    const existing = scheduleRepository.findById(scheduleId)
    if (!existing) throw new NotFoundError('일정을 찾을 수 없습니다')

    const startAt =
      data.startAt ??
      (existing.startAt instanceof Date
        ? existing.startAt
        : new Date(existing.startAt as number))
    const endAt =
      data.endAt ??
      (existing.endAt instanceof Date ? existing.endAt : new Date(existing.endAt as number))

    if (startAt > endAt) {
      throw new ValidationError('시작 시간이 종료 시간보다 늦을 수 없습니다')
    }

    const allDay = data.allDay ?? existing.allDay
    let finalStartAt = data.startAt
    let finalEndAt = data.endAt

    if (data.allDay !== undefined && allDay) {
      finalStartAt = new Date(
        startAt.getFullYear(),
        startAt.getMonth(),
        startAt.getDate(),
        0,
        0,
        0,
        0
      )
      finalEndAt = new Date(
        endAt.getFullYear(),
        endAt.getMonth(),
        endAt.getDate(),
        23,
        59,
        59,
        999
      )
    }

    const row = scheduleRepository.update(scheduleId, {
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.allDay !== undefined && { allDay }),
      ...(finalStartAt && { startAt: finalStartAt }),
      ...(finalEndAt && { endAt: finalEndAt }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.priority !== undefined && { priority: data.priority }),
      updatedAt: new Date(),
    })

    if (!row) throw new NotFoundError('일정을 찾을 수 없습니다')
    return toScheduleItem(row)
  },

  remove(scheduleId: string): void {
    const existing = scheduleRepository.findById(scheduleId)
    if (!existing) throw new NotFoundError('일정을 찾을 수 없습니다')
    scheduleRepository.delete(scheduleId)
  },

  move(scheduleId: string, startAt: Date, endAt: Date): ScheduleItem {
    const existing = scheduleRepository.findById(scheduleId)
    if (!existing) throw new NotFoundError('일정을 찾을 수 없습니다')

    if (startAt > endAt) {
      throw new ValidationError('시작 시간이 종료 시간보다 늦을 수 없습니다')
    }

    const row = scheduleRepository.update(scheduleId, {
      startAt,
      endAt,
      updatedAt: new Date(),
    })

    if (!row) throw new NotFoundError('일정을 찾을 수 없습니다')
    return toScheduleItem(row)
  },

  linkTodo(scheduleId: string, todoId: string): void {
    const schedule = scheduleRepository.findById(scheduleId)
    if (!schedule) throw new NotFoundError('일정을 찾을 수 없습니다')

    const todo = todoRepository.findById(todoId)
    if (!todo) throw new NotFoundError('할 일을 찾을 수 없습니다')

    scheduleTodoRepository.link(scheduleId, todoId)
  },

  unlinkTodo(scheduleId: string, todoId: string): void {
    scheduleTodoRepository.unlink(scheduleId, todoId)
  },

  getLinkedTodos(scheduleId: string): TodoItem[] {
    const schedule = scheduleRepository.findById(scheduleId)
    if (!schedule) throw new NotFoundError('일정을 찾을 수 없습니다')

    const todoRows = scheduleTodoRepository.findTodosByScheduleId(scheduleId)
    return todoRows.map(toTodoItem)
  },
}

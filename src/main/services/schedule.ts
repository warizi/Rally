import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { scheduleRepository } from '../repositories/schedule'
import { scheduleTodoRepository } from '../repositories/schedule-todo'
import { workspaceRepository } from '../repositories/workspace'
import { todoRepository } from '../repositories/todo'
import { entityLinkService } from './entity-link'
import { reminderService } from './reminder'
import { embeddingService } from './embedding'
import { canvasNodeRepository } from '../repositories/canvas-node'
import { trashService } from './trash'
import type { Schedule } from '../repositories/schedule'
import type { Todo } from '../repositories/todo'
import { type Actor, USER_ACTOR, toCreatedFields, toUpdatedFields } from './_shared/actor'
import { toDate, toNullableDate } from './_shared/date'

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
  createdBy: 'user' | 'ai'
  createdById: string | null
  updatedBy: 'user' | 'ai'
  updatedById: string | null
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
  createdBy: 'user' | 'ai'
  createdById: string | null
  updatedBy: 'user' | 'ai'
  updatedById: string | null
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
    startAt: toDate(row.startAt),
    endAt: toDate(row.endAt),
    color: row.color,
    priority: row.priority as ScheduleItem['priority'],
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    createdBy: (row.createdBy ?? 'user') as 'user' | 'ai',
    createdById: row.createdById ?? null,
    updatedBy: (row.updatedBy ?? 'user') as 'user' | 'ai',
    updatedById: row.updatedById ?? null
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
    createdAt: toDate(todo.createdAt),
    updatedAt: toDate(todo.updatedAt),
    doneAt: toNullableDate(todo.doneAt),
    dueDate: toNullableDate(todo.dueDate),
    startDate: toNullableDate(todo.startDate),
    createdBy: (todo.createdBy ?? 'user') as 'user' | 'ai',
    createdById: todo.createdById ?? null,
    updatedBy: (todo.updatedBy ?? 'user') as 'user' | 'ai',
    updatedById: todo.updatedById ?? null
  }
}

// === Service ===

export const scheduleService = {
  findAllByWorkspace(workspaceId: string): ScheduleItem[] {
    const rows = scheduleRepository.findAllByWorkspaceId(workspaceId)
    return rows.map(toScheduleItem)
  },

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

  create(workspaceId: string, data: CreateScheduleData, actor: Actor = USER_ACTOR): ScheduleItem {
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
      ...toCreatedFields(actor)
    })

    embeddingService.enqueue('schedule', row.id)
    return toScheduleItem(row)
  },

  update(scheduleId: string, data: UpdateScheduleData, actor: Actor = USER_ACTOR): ScheduleItem {
    const existing = scheduleRepository.findById(scheduleId)
    if (!existing) throw new NotFoundError('일정을 찾을 수 없습니다')

    const startAt = data.startAt ?? toDate(existing.startAt)
    const endAt = data.endAt ?? toDate(existing.endAt)

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
      finalEndAt = new Date(endAt.getFullYear(), endAt.getMonth(), endAt.getDate(), 23, 59, 59, 999)
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
      ...toUpdatedFields(actor)
    })

    if (!row) throw new NotFoundError('일정을 찾을 수 없습니다')

    // 시간 또는 종일 속성 변경 시 알림 재계산
    if (data.startAt !== undefined || data.allDay !== undefined) {
      reminderService.recalculate('schedule', scheduleId)
    }

    embeddingService.enqueue('schedule', scheduleId)
    return toScheduleItem(row)
  },

  /**
   * Schedule 삭제. 기본은 휴지통 이동. permanent=true: 즉시 영구 삭제.
   */
  remove(scheduleId: string, options: { permanent?: boolean } = {}): void {
    const existing = scheduleRepository.findById(scheduleId)
    if (!existing) throw new NotFoundError('일정을 찾을 수 없습니다')

    embeddingService.remove('schedule', scheduleId)

    if (!options.permanent) {
      if (!existing.workspaceId) {
        throw new ValidationError('워크스페이스 정보가 없는 일정은 휴지통으로 보낼 수 없습니다')
      }
      trashService.softRemove(existing.workspaceId, 'schedule', scheduleId)
      return
    }

    reminderService.removeByEntity('schedule', scheduleId)
    entityLinkService.removeAllLinks('schedule', scheduleId)
    canvasNodeRepository.deleteByRef('schedule', scheduleId)
    scheduleRepository.delete(scheduleId)
  },

  move(scheduleId: string, startAt: Date, endAt: Date, actor: Actor = USER_ACTOR): ScheduleItem {
    const existing = scheduleRepository.findById(scheduleId)
    if (!existing) throw new NotFoundError('일정을 찾을 수 없습니다')

    if (startAt > endAt) {
      throw new ValidationError('시작 시간이 종료 시간보다 늦을 수 없습니다')
    }

    const row = scheduleRepository.update(scheduleId, {
      startAt,
      endAt,
      updatedAt: new Date(),
      ...toUpdatedFields(actor)
    })

    if (!row) throw new NotFoundError('일정을 찾을 수 없습니다')

    // 캘린더 드래그로 시간 변경 시 알림 재계산
    reminderService.recalculate('schedule', scheduleId)

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
  }
}

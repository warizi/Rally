import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { reminderRepository } from '../repositories/reminder'
import { todoRepository } from '../repositories/todo'
import { scheduleRepository } from '../repositories/schedule'
import type { Reminder } from '../repositories/reminder'

// === 허용 오프셋 값 (유효성 검증용) ===

const VALID_OFFSETS = new Set([
  10 * 60 * 1000, // 10분
  30 * 60 * 1000, // 30분
  60 * 60 * 1000, // 1시간
  24 * 60 * 60 * 1000, // 1일
  2 * 24 * 60 * 60 * 1000 // 2일
])

// === Domain Types ===

export interface ReminderItem {
  id: string
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
  remindAt: Date
  isFired: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SetReminderData {
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
}

// === Mapper ===

function toReminderItem(row: Reminder): ReminderItem {
  return {
    id: row.id,
    entityType: row.entityType as ReminderItem['entityType'],
    entityId: row.entityId,
    offsetMs: row.offsetMs,
    remindAt: row.remindAt instanceof Date ? row.remindAt : new Date(row.remindAt as number),
    isFired: row.isFired,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as number),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as number)
  }
}

// === remind_at 계산 ===

type EntityType = 'todo' | 'schedule'

function getBaseTime(entityType: EntityType, entityId: string): Date | null {
  if (entityType === 'todo') {
    const todo = todoRepository.findById(entityId)
    if (!todo) return null
    // dueDate 우선, 없으면 startDate
    const raw = todo.dueDate ?? todo.startDate
    if (!raw) return null
    return raw instanceof Date ? raw : new Date(raw as number)
  }

  if (entityType === 'schedule') {
    const schedule = scheduleRepository.findById(entityId)
    if (!schedule) return null
    const startAt =
      schedule.startAt instanceof Date ? schedule.startAt : new Date(schedule.startAt as number)
    // allDay: 00:00 → 09:00 보정
    if (schedule.allDay) {
      const adjusted = new Date(startAt)
      adjusted.setHours(9, 0, 0, 0)
      return adjusted
    }
    return startAt
  }

  return null
}

function calcRemindAt(baseTime: Date, offsetMs: number): Date {
  return new Date(baseTime.getTime() - offsetMs)
}

// === Service ===

export const reminderService = {
  findByEntity(entityType: EntityType, entityId: string): ReminderItem[] {
    return reminderRepository.findByEntity(entityType, entityId).map(toReminderItem)
  },

  set(data: SetReminderData): ReminderItem {
    // 유효한 offset 값 검증
    if (!VALID_OFFSETS.has(data.offsetMs)) {
      throw new ValidationError('유효하지 않은 알림 오프셋입니다')
    }

    const baseTime = getBaseTime(data.entityType, data.entityId)
    if (!baseTime) {
      throw new NotFoundError('알림 기준 시각을 찾을 수 없습니다')
    }

    const now = new Date()
    const remindAt = calcRemindAt(baseTime, data.offsetMs)

    // 과거 시각이면 알림 생성 건너뜀 (이미 지난 알림은 의미 없음)
    if (remindAt.getTime() <= now.getTime()) {
      throw new ValidationError('알림 시각이 이미 지났습니다')
    }

    // 동일 entity + 동일 offset 중복 방지
    const existing = reminderRepository.findByEntity(data.entityType, data.entityId)
    const duplicate = existing.find((r) => r.offsetMs === data.offsetMs)
    if (duplicate) {
      // 이미 존재하면 remind_at 재계산만
      const updated = reminderRepository.update(duplicate.id, {
        remindAt,
        isFired: false,
        updatedAt: now
      })
      return toReminderItem(updated!)
    }

    const row = reminderRepository.create({
      id: nanoid(),
      entityType: data.entityType,
      entityId: data.entityId,
      offsetMs: data.offsetMs,
      remindAt,
      isFired: false,
      createdAt: now,
      updatedAt: now
    })

    return toReminderItem(row)
  },

  remove(reminderId: string): void {
    const reminder = reminderRepository.findById(reminderId)
    if (!reminder) throw new NotFoundError('알림을 찾을 수 없습니다')
    reminderRepository.delete(reminderId)
  },

  removeByEntity(entityType: EntityType, entityId: string): void {
    reminderRepository.deleteByEntity(entityType, entityId)
  },

  removeByEntities(entityType: EntityType, entityIds: string[]): void {
    reminderRepository.deleteByEntities(entityType, entityIds)
  },

  /** 미발송 알림만 삭제 (완료 시 사용) */
  removeUnfiredByEntity(entityType: EntityType, entityId: string): void {
    reminderRepository.deleteUnfiredByEntity(entityType, entityId)
  },

  /** entity 시간 변경 시 모든 알림의 remind_at 재계산 */
  recalculate(entityType: EntityType, entityId: string): void {
    const baseTime = getBaseTime(entityType, entityId)
    if (!baseTime) {
      // 기준 시각 없음 → 모든 알림 삭제
      reminderRepository.deleteByEntity(entityType, entityId)
      return
    }

    const existing = reminderRepository.findByEntity(entityType, entityId)
    const now = new Date()
    for (const r of existing) {
      const newRemindAt = calcRemindAt(baseTime, r.offsetMs)
      reminderRepository.update(r.id, {
        remindAt: newRemindAt,
        isFired: false,
        updatedAt: now
      })
    }
  },

  /** 스케줄러용: 발송 대상 조회 + entity 제목/워크스페이스 포함 */
  findPendingWithTitle(
    now: Date
  ): Array<ReminderItem & { title: string; workspaceId: string | null }> {
    const pending = reminderRepository.findPending(now)
    const results: Array<ReminderItem & { title: string; workspaceId: string | null }> = []

    for (const r of pending) {
      let title = ''
      let workspaceId: string | null = null
      if (r.entityType === 'todo') {
        const todo = todoRepository.findById(r.entityId)
        title = todo?.title ?? '(삭제된 할 일)'
        workspaceId = todo?.workspaceId ?? null
      } else if (r.entityType === 'schedule') {
        const schedule = scheduleRepository.findById(r.entityId)
        title = schedule?.title ?? '(삭제된 일정)'
        workspaceId = schedule?.workspaceId ?? null
      }
      results.push({ ...toReminderItem(r), title, workspaceId })
    }

    return results
  },

  markFired(reminderId: string): void {
    reminderRepository.markFired(reminderId, new Date())
  }
}

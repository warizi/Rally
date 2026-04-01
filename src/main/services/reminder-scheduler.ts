import { Notification, BrowserWindow } from 'electron'
import { reminderService } from './reminder'
import { recurringRuleService } from './recurring-rule'
import { workspaceService } from './workspace'
import icon from '../../../resources/256x256.png?asset'

const CHECK_INTERVAL = 60_000 // 1분
const STALE_THRESHOLD = 5 * 60_000 // 5분: 이보다 오래된 미발송 알림은 무시

const OFFSET_LABELS: Record<number, string> = {
  [10 * 60 * 1000]: '10분 전',
  [30 * 60 * 1000]: '30분 전',
  [60 * 60 * 1000]: '1시간 전',
  [24 * 60 * 60 * 1000]: '1일 전',
  [2 * 24 * 60 * 60 * 1000]: '2일 전'
}

let intervalId: ReturnType<typeof setInterval> | null = null

// 반복할일 알림 중복 방지: "ruleId:YYYY-MM-DD" 형식으로 오늘 발송된 것 추적
const firedRecurringReminders = new Set<string>()

function getTodayDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fireNotification(
  title: string,
  body: string,
  entityType: string,
  entityId: string,
  workspaceId: string | null
): void {
  const notification = new Notification({ title, body, icon })
  notification.on('click', () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('reminder:fired', { entityType, entityId, title: body, workspaceId })
    })
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
  notification.show()
}

function checkAndFire(): void {
  try {
    const now = new Date()

    // 1. 기존 todo/schedule 알림 처리
    const pending = reminderService.findPendingWithTitle(now)
    for (const item of pending) {
      try {
        if (now.getTime() - item.remindAt.getTime() > STALE_THRESHOLD) {
          reminderService.markFired(item.id)
          continue
        }
        const offsetLabel = OFFSET_LABELS[item.offsetMs] ?? ''
        const typeLabel = item.entityType === 'todo' ? '할 일' : '일정'
        const title = offsetLabel ? `${typeLabel} 알림 · ${offsetLabel}` : `${typeLabel} 알림`
        fireNotification(title, item.title, item.entityType, item.entityId, item.workspaceId)
        reminderService.markFired(item.id)
      } catch (err) {
        console.error('[ReminderScheduler] 개별 알림 발송 실패:', item.id, err)
        reminderService.markFired(item.id)
      }
    }

    // 2. 반복할일 알림 처리
    try {
      const todayStr = getTodayDateString(now)
      const workspaces = workspaceService.getAll()

      for (const workspace of workspaces) {
        const todayRules = recurringRuleService.findTodayRules(workspace.id, now)

        for (const rule of todayRules) {
          if (!rule.reminderOffsetMs || !rule.startTime) continue

          const firedKey = `${rule.id}:${todayStr}`
          if (firedRecurringReminders.has(firedKey)) continue

          // startTime("HH:mm")을 오늘 날짜 기준 Date로 변환
          const [hh, mm] = rule.startTime.split(':').map(Number)
          const startDateTime = new Date(now)
          startDateTime.setHours(hh, mm, 0, 0)

          const remindAt = new Date(startDateTime.getTime() - rule.reminderOffsetMs)
          const diff = now.getTime() - remindAt.getTime()

          // 아직 발송 시각이 안 됐거나 5분 이상 지난 경우 스킵
          if (diff < 0 || diff > STALE_THRESHOLD) continue

          const offsetLabel = OFFSET_LABELS[rule.reminderOffsetMs] ?? ''
          const title = offsetLabel ? `반복 할일 알림 · ${offsetLabel}` : '반복 할일 알림'
          fireNotification(title, rule.title, 'recurring_rule', rule.id, rule.workspaceId)
          firedRecurringReminders.add(firedKey)
        }
      }
    } catch (err) {
      console.error('[ReminderScheduler] 반복할일 알림 처리 실패:', err)
    }
  } catch (err) {
    console.error('[ReminderScheduler] 알림 스캔 실패:', err)
  }
}

export const reminderScheduler = {
  start(): void {
    if (intervalId) return
    // 앱 시작 시 즉시 1회 체크
    checkAndFire()
    intervalId = setInterval(checkAndFire, CHECK_INTERVAL)
  },

  stop(): void {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}

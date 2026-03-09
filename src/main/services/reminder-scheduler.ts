import { Notification, BrowserWindow } from 'electron'
import { reminderService } from './reminder'
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

function checkAndFire(): void {
  try {
    const now = new Date()
    const pending = reminderService.findPendingWithTitle(now)

    for (const item of pending) {
      try {
        // 과거 알림 필터: remind_at이 5분 이상 지난 알림은 발송하지 않고 fired 처리만
        if (now.getTime() - item.remindAt.getTime() > STALE_THRESHOLD) {
          reminderService.markFired(item.id)
          continue
        }

        // Notification 발송
        const offsetLabel = OFFSET_LABELS[item.offsetMs] ?? ''
        const typeLabel = item.entityType === 'todo' ? '할 일' : '일정'
        const notification = new Notification({
          title: offsetLabel ? `${typeLabel} 알림 · ${offsetLabel}` : `${typeLabel} 알림`,
          body: item.title,
          icon
        })

        notification.on('click', () => {
          // 모든 윈도우에 알림 클릭 이벤트 전송 (workspaceId 포함 → 워크스페이스 전환용)
          BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send('reminder:fired', {
              entityType: item.entityType,
              entityId: item.entityId,
              title: item.title,
              workspaceId: item.workspaceId
            })
          })
          // 첫 번째 윈도우 포커스
          const win = BrowserWindow.getAllWindows()[0]
          if (win) {
            if (win.isMinimized()) win.restore()
            win.focus()
          }
        })

        notification.show()

        // 발송 완료 마킹
        reminderService.markFired(item.id)
      } catch (err) {
        console.error('[ReminderScheduler] 개별 알림 발송 실패:', item.id, err)
        // 개별 실패 시 fired 처리하여 반복 실패 방지
        reminderService.markFired(item.id)
      }
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

import { trashService } from './trash'

const CHECK_INTERVAL = 60 * 60 * 1000 // 1시간

let intervalId: ReturnType<typeof setInterval> | null = null

function runSweep(): void {
  try {
    const purged = trashService.sweepAll()
    if (purged > 0) {
      console.log(`[TrashSweeper] purged ${purged} batches`)
    }
  } catch (err) {
    console.error('[TrashSweeper] sweep failed:', err)
  }
}

/**
 * 자동 휴지통 비우기 cron — 1시간마다 모든 워크스페이스의 만료 batch 영구 삭제.
 * 만료 기준은 사용자 설정 (`trash.autoEmptyDays`, default 30일).
 * 'never' 설정 시 모든 sweep 건너뜀 — 사용자가 수동으로만 비울 수 있음.
 */
export const trashSweeper = {
  start(): void {
    if (intervalId) return
    // 앱 시작 시 즉시 1회 (오랜 시간 꺼져있던 동안 만료된 항목 정리)
    runSweep()
    intervalId = setInterval(runSweep, CHECK_INTERVAL)
  },

  stop(): void {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  },

  /** 테스트/수동 호출용 — interval 시작 없이 한 번만 실행 */
  runOnce(): void {
    runSweep()
  }
}

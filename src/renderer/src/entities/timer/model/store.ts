/**
 * 타이머 전역 store (Zustand).
 *
 * 핵심 설계:
 * - store 는 컴포넌트 외부에 살아있으므로 페이지 unmount 후에도 카운트다운 / 알림이
 *   계속 동작. setInterval 핸들도 store 내부에서 관리.
 * - 정확도: setInterval 은 drift 가 있으므로 `endAt = Date.now() + durationMs` 를
 *   고정해두고 매 tick 에서 `endAt - Date.now()` 로 남은 시간을 계산.
 * - 동시 1개만 작동. start 호출 시 기존 interval clear 후 재설정.
 */
import { create } from 'zustand'

export const TIMER_MIN_DURATION_MS = 5_000
export const TIMER_MAX_DURATION_MS = 24 * 60 * 60 * 1000

interface TimerState {
  /** 사용자가 설정한 총 타이머 길이 (ms). 시작 전/후 모두 유지. */
  durationMs: number
  /** 시작 시점에 Date.now() + 남은시간. 일시정지 / 미실행 시 null. */
  endAt: number | null
  /** 일시정지 시 남은 시간 (ms). 실행/미실행 시 null. */
  pausedRemainingMs: number | null
  /** 현재 카운트다운 진행 중 여부. */
  isRunning: boolean
  /** UI 에 표시할 남은 시간 (ms). tick 으로 갱신. */
  remainingMs: number
  /** 알림 다이얼로그 활성 여부. true 면 어디서든 다이얼로그 표시. */
  alarmActive: boolean
}

interface TimerActions {
  setDuration: (ms: number) => void
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  dismissAlarm: () => void
}

type TimerStore = TimerState & TimerActions

// interval handle 은 store state 밖에서 관리 (state subscribe 영향 없음)
let intervalHandle: ReturnType<typeof setInterval> | null = null

function clearTimerInterval(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}

export const useTimerStore = create<TimerStore>()((set, get) => {
  function startInterval(): void {
    clearTimerInterval()
    intervalHandle = setInterval(() => {
      const { endAt } = get()
      if (endAt == null) {
        clearTimerInterval()
        return
      }
      const remaining = endAt - Date.now()
      if (remaining <= 0) {
        // 알람 발동: interval 정지, isRunning=false, alarmActive=true.
        // durationMs 는 보존 (사용자가 다이얼로그 dismiss 후 같은 길이로 다시 시작 가능)
        clearTimerInterval()
        set({
          remainingMs: 0,
          isRunning: false,
          endAt: null,
          pausedRemainingMs: null,
          alarmActive: true
        })
        return
      }
      set({ remainingMs: remaining })
    }, 250)
  }

  return {
    durationMs: 0,
    endAt: null,
    pausedRemainingMs: null,
    isRunning: false,
    remainingMs: 0,
    alarmActive: false,

    setDuration: (ms: number) => {
      // 실행 중이거나 알람 활성 시 변경 차단 (UI 에서 disabled 가 1차 가드)
      if (get().isRunning || get().alarmActive) return
      const clamped = Math.max(0, Math.min(TIMER_MAX_DURATION_MS, ms))
      set({ durationMs: clamped, remainingMs: clamped })
    },

    start: () => {
      const { durationMs, isRunning, alarmActive } = get()
      if (isRunning || alarmActive) return
      if (durationMs < TIMER_MIN_DURATION_MS) return
      const endAt = Date.now() + durationMs
      set({
        endAt,
        pausedRemainingMs: null,
        isRunning: true,
        remainingMs: durationMs
      })
      startInterval()
    },

    pause: () => {
      const { endAt, isRunning } = get()
      if (!isRunning || endAt == null) return
      const remaining = Math.max(0, endAt - Date.now())
      clearTimerInterval()
      set({
        endAt: null,
        pausedRemainingMs: remaining,
        isRunning: false,
        remainingMs: remaining
      })
    },

    resume: () => {
      const { pausedRemainingMs, isRunning, alarmActive } = get()
      if (isRunning || alarmActive) return
      if (pausedRemainingMs == null || pausedRemainingMs <= 0) return
      const endAt = Date.now() + pausedRemainingMs
      set({
        endAt,
        pausedRemainingMs: null,
        isRunning: true,
        remainingMs: pausedRemainingMs
      })
      startInterval()
    },

    reset: () => {
      clearTimerInterval()
      const { durationMs } = get()
      set({
        endAt: null,
        pausedRemainingMs: null,
        isRunning: false,
        remainingMs: durationMs,
        alarmActive: false
      })
    },

    dismissAlarm: () => {
      // 알람 닫고 타이머는 초기 상태로 (durationMs 보존)
      clearTimerInterval()
      const { durationMs } = get()
      set({
        endAt: null,
        pausedRemainingMs: null,
        isRunning: false,
        remainingMs: durationMs,
        alarmActive: false
      })
    }
  }
})

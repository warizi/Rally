import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useTimerStore, TIMER_MIN_DURATION_MS } from '../store'

function resetStore(): void {
  useTimerStore.getState().reset()
  // setDuration 으로 초기화 (reset 은 durationMs 보존하므로 명시 0)
  useTimerStore.setState({ durationMs: 0, remainingMs: 0 })
}

describe('useTimerStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    resetStore()
  })

  afterEach(() => {
    useTimerStore.getState().reset()
    vi.useRealTimers()
  })

  it('setDuration: 0 이상 24시간 이하로 clamp', () => {
    useTimerStore.getState().setDuration(10_000)
    expect(useTimerStore.getState().durationMs).toBe(10_000)
    expect(useTimerStore.getState().remainingMs).toBe(10_000)

    useTimerStore.getState().setDuration(-100)
    expect(useTimerStore.getState().durationMs).toBe(0)

    useTimerStore.getState().setDuration(25 * 60 * 60 * 1000)
    expect(useTimerStore.getState().durationMs).toBe(24 * 60 * 60 * 1000)
  })

  it('start: 최소 시간(5초) 미만이면 무시', () => {
    useTimerStore.getState().setDuration(TIMER_MIN_DURATION_MS - 1)
    useTimerStore.getState().start()
    expect(useTimerStore.getState().isRunning).toBe(false)
    expect(useTimerStore.getState().endAt).toBeNull()
  })

  it('start: endAt 설정 + isRunning=true', () => {
    useTimerStore.getState().setDuration(10_000)
    useTimerStore.getState().start()
    const state = useTimerStore.getState()
    expect(state.isRunning).toBe(true)
    expect(state.endAt).toBe(Date.now() + 10_000)
    expect(state.remainingMs).toBe(10_000)
  })

  it('tick: 시간 경과에 따라 remainingMs 갱신', () => {
    useTimerStore.getState().setDuration(10_000)
    useTimerStore.getState().start()
    vi.advanceTimersByTime(3_000)
    expect(useTimerStore.getState().remainingMs).toBeLessThanOrEqual(7_000)
    expect(useTimerStore.getState().remainingMs).toBeGreaterThan(6_500)
  })

  it('tick: endAt 도달 시 alarmActive=true + isRunning=false', () => {
    useTimerStore.getState().setDuration(5_000)
    useTimerStore.getState().start()
    vi.advanceTimersByTime(5_001)
    const state = useTimerStore.getState()
    expect(state.alarmActive).toBe(true)
    expect(state.isRunning).toBe(false)
    expect(state.endAt).toBeNull()
    expect(state.remainingMs).toBe(0)
  })

  it('pause / resume: 남은 시간 보존', () => {
    useTimerStore.getState().setDuration(10_000)
    useTimerStore.getState().start()
    vi.advanceTimersByTime(3_000)
    useTimerStore.getState().pause()
    const paused = useTimerStore.getState()
    expect(paused.isRunning).toBe(false)
    expect(paused.endAt).toBeNull()
    expect(paused.pausedRemainingMs).toBeLessThanOrEqual(7_000)
    expect(paused.pausedRemainingMs).toBeGreaterThan(6_500)
    const remainingBeforeResume = paused.pausedRemainingMs!

    // pause 중 시간이 흘러도 영향 없음
    vi.advanceTimersByTime(10_000)
    expect(useTimerStore.getState().pausedRemainingMs).toBe(remainingBeforeResume)

    useTimerStore.getState().resume()
    const resumed = useTimerStore.getState()
    expect(resumed.isRunning).toBe(true)
    expect(resumed.pausedRemainingMs).toBeNull()
    expect(resumed.endAt).toBe(Date.now() + remainingBeforeResume)
  })

  it('reset: durationMs 는 보존, 나머지 초기화', () => {
    useTimerStore.getState().setDuration(10_000)
    useTimerStore.getState().start()
    vi.advanceTimersByTime(3_000)
    useTimerStore.getState().reset()
    const state = useTimerStore.getState()
    expect(state.durationMs).toBe(10_000)
    expect(state.remainingMs).toBe(10_000)
    expect(state.isRunning).toBe(false)
    expect(state.endAt).toBeNull()
    expect(state.pausedRemainingMs).toBeNull()
    expect(state.alarmActive).toBe(false)
  })

  it('dismissAlarm: 알람 닫히고 초기 상태로 복귀', () => {
    useTimerStore.getState().setDuration(5_000)
    useTimerStore.getState().start()
    vi.advanceTimersByTime(5_001)
    expect(useTimerStore.getState().alarmActive).toBe(true)

    useTimerStore.getState().dismissAlarm()
    const state = useTimerStore.getState()
    expect(state.alarmActive).toBe(false)
    expect(state.isRunning).toBe(false)
    expect(state.durationMs).toBe(5_000)
    expect(state.remainingMs).toBe(5_000)
  })

  it('isRunning 중에는 setDuration 무시', () => {
    useTimerStore.getState().setDuration(10_000)
    useTimerStore.getState().start()
    useTimerStore.getState().setDuration(20_000)
    expect(useTimerStore.getState().durationMs).toBe(10_000)
  })

  it('alarmActive 중에는 start 무시', () => {
    useTimerStore.getState().setDuration(5_000)
    useTimerStore.getState().start()
    vi.advanceTimersByTime(5_001)
    expect(useTimerStore.getState().alarmActive).toBe(true)
    useTimerStore.getState().start()
    expect(useTimerStore.getState().endAt).toBeNull()
    expect(useTimerStore.getState().isRunning).toBe(false)
  })
})

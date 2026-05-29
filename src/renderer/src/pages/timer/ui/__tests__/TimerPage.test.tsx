/**
 * pages/timer/ui/TimerPage.test.tsx
 *
 * 타이머 상태별 버튼 분기 + 디지털 카운트 + 설정 다이얼로그 토글.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@shared/ui/tooltip'
import type { ReactElement } from 'react'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  )
}

const mocks = vi.hoisted(() => ({
  durationMs: 60 * 1000,
  remainingMs: 60 * 1000,
  isRunning: false,
  pausedRemainingMs: null as number | null,
  alarmActive: false,
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  reset: vi.fn()
}))

vi.mock('@/entities/timer', () => ({
  useTimerStore: (
    sel: (s: {
      durationMs: number
      remainingMs: number
      isRunning: boolean
      pausedRemainingMs: number | null
      alarmActive: boolean
      start: typeof mocks.start
      pause: typeof mocks.pause
      resume: typeof mocks.resume
      reset: typeof mocks.reset
    }) => unknown
  ) =>
    sel({
      durationMs: mocks.durationMs,
      remainingMs: mocks.remainingMs,
      isRunning: mocks.isRunning,
      pausedRemainingMs: mocks.pausedRemainingMs,
      alarmActive: mocks.alarmActive,
      start: mocks.start,
      pause: mocks.pause,
      resume: mocks.resume,
      reset: mocks.reset
    }),
  TIMER_MIN_DURATION_MS: 5000
}))
// TimerSettingsDialog 는 별도 컴포넌트 — TimerPage 자체만 테스트
vi.mock('../TimerSettingsDialog', () => ({
  TimerSettingsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="settings-dialog">settings</div> : null
}))

import TimerPage from '../TimerPage'

beforeEach(() => {
  mocks.durationMs = 60 * 1000
  mocks.remainingMs = 60 * 1000
  mocks.isRunning = false
  mocks.pausedRemainingMs = null
  mocks.alarmActive = false
  mocks.start.mockClear()
  mocks.pause.mockClear()
  mocks.resume.mockClear()
  mocks.reset.mockClear()
})

describe('TimerPage', () => {
  it('초기 상태 (정지) → "시작" + "초기화" 버튼', () => {
    r(<TimerPage />)
    expect(screen.getByRole('button', { name: /시작/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /초기화/ })).toBeInTheDocument()
  })

  it('디지털 카운트 표시 (1분 → 00:01:00)', () => {
    r(<TimerPage />)
    expect(screen.getByText('00:01:00')).toBeInTheDocument()
  })

  it('canStart=false (duration < 최소) → "시간을 설정해주세요" + 시작 disabled', () => {
    mocks.durationMs = 1000
    mocks.remainingMs = 1000
    r(<TimerPage />)
    expect(screen.getByText(/시간을 설정해주세요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /시작/ })).toBeDisabled()
  })

  it('isRunning=true → "일시정지" 버튼', () => {
    mocks.isRunning = true
    r(<TimerPage />)
    expect(screen.getByRole('button', { name: /일시정지/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /시작/ })).not.toBeInTheDocument()
  })

  it('isPaused (pausedRemainingMs > 0) → "재개" 버튼', () => {
    mocks.isRunning = false
    mocks.pausedRemainingMs = 30 * 1000
    r(<TimerPage />)
    expect(screen.getByRole('button', { name: /재개/ })).toBeInTheDocument()
  })

  it('시작 클릭 → start 호출', () => {
    r(<TimerPage />)
    fireEvent.click(screen.getByRole('button', { name: /시작/ }))
    expect(mocks.start).toHaveBeenCalled()
  })

  it('일시정지 클릭 → pause 호출', () => {
    mocks.isRunning = true
    r(<TimerPage />)
    fireEvent.click(screen.getByRole('button', { name: /일시정지/ }))
    expect(mocks.pause).toHaveBeenCalled()
  })

  it('초기화 클릭 → reset 호출', () => {
    r(<TimerPage />)
    fireEvent.click(screen.getByRole('button', { name: /초기화/ }))
    expect(mocks.reset).toHaveBeenCalled()
  })

  it('alarmActive=true → 초기화 disabled + 시간 설정 disabled', () => {
    mocks.alarmActive = true
    r(<TimerPage />)
    expect(screen.getByRole('button', { name: /초기화/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /시간 설정/ })).toBeDisabled()
  })

  it('"시간 설정" 클릭 → TimerSettingsDialog 표시', () => {
    r(<TimerPage />)
    fireEvent.click(screen.getByRole('button', { name: /시간 설정/ }))
    expect(screen.getByTestId('settings-dialog')).toBeInTheDocument()
  })
})

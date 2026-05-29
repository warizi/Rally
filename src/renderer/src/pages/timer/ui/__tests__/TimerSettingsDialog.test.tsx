/**
 * pages/timer/ui/TimerSettingsDialog.test.tsx
 *
 * 시/분/초 Select 의 초기값 / 확인 클릭 → setDuration / 5초 미만 disabled.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  durationMs: 60 * 1000, // 1분
  setDuration: vi.fn()
}))

vi.mock('@/entities/timer', () => {
  const storeFn = (
    sel?: (s: { durationMs: number; setDuration: typeof mocks.setDuration }) => unknown
  ): unknown => sel?.({ durationMs: mocks.durationMs, setDuration: mocks.setDuration })
  ;(storeFn as unknown as { getState: () => unknown }).getState = () => ({
    durationMs: mocks.durationMs,
    setDuration: mocks.setDuration
  })
  return { useTimerStore: storeFn, TIMER_MIN_DURATION_MS: 5000 }
})

import { TimerSettingsDialog } from '../TimerSettingsDialog'

beforeEach(() => {
  mocks.durationMs = 60 * 1000
  mocks.setDuration.mockClear()
})

describe('TimerSettingsDialog', () => {
  it('open=false → 콘텐츠 미렌더', () => {
    render(<TimerSettingsDialog open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByText('시간 설정')).not.toBeInTheDocument()
  })

  it('open=true → 타이틀 + 시/분/초 셀렉트 노출', () => {
    render(<TimerSettingsDialog open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText('시간 설정')).toBeInTheDocument()
    expect(screen.getByText(/최소 5초 이상/)).toBeInTheDocument()
    // 초기 1분 → 0시 1분 0초
    expect(screen.getByText('0시')).toBeInTheDocument()
    expect(screen.getByText('1분')).toBeInTheDocument()
    expect(screen.getByText('0초')).toBeInTheDocument()
  })

  it('취소 클릭 → onOpenChange(false) 호출', () => {
    const fn = vi.fn()
    render(<TimerSettingsDialog open={true} onOpenChange={fn} />)
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(fn).toHaveBeenCalledWith(false)
  })

  it('확인 클릭 → setDuration + onOpenChange(false)', () => {
    const fn = vi.fn()
    render(<TimerSettingsDialog open={true} onOpenChange={fn} />)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(mocks.setDuration).toHaveBeenCalledWith(60 * 1000)
    expect(fn).toHaveBeenCalledWith(false)
  })

  it('durationMs < 5초 → 확인 버튼 disabled + 경고 노출', () => {
    mocks.durationMs = 2000 // 2초
    render(<TimerSettingsDialog open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled()
    expect(screen.getByText('5초 이상으로 설정해주세요.')).toBeInTheDocument()
  })
})

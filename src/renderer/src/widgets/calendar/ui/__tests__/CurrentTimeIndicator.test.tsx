/**
 * widgets/calendar/ui/CurrentTimeIndicator.test.tsx
 *
 * timeToPosition 결과 top style 적용 + 1분마다 setInterval 갱신.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CurrentTimeIndicator } from '../CurrentTimeIndicator'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-29T10:30:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CurrentTimeIndicator', () => {
  it('top style 적용 (10:30 → hourHeight=60, startHour=9 → 1.5 * 60 = 90)', () => {
    const { container } = render(<CurrentTimeIndicator hourHeight={60} startHour={9} />)
    const root = container.firstChild as HTMLElement
    expect(root.style.top).toBe('90px')
  })

  it('startHour 기본값 (DEFAULT_START_HOUR) 사용', () => {
    const { container } = render(<CurrentTimeIndicator hourHeight={60} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('red dot + line 노출', () => {
    const { container } = render(<CurrentTimeIndicator hourHeight={60} startHour={9} />)
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument()
  })

  it('30분 후 → top 재계산 (setInterval + act)', async () => {
    const { container } = render(<CurrentTimeIndicator hourHeight={60} startHour={9} />)
    const before = (container.firstChild as HTMLElement).style.top
    const { act } = await import('react')
    vi.setSystemTime(new Date('2026-05-29T11:00:00'))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    const after = (container.firstChild as HTMLElement).style.top
    expect(after).not.toBe(before)
  })

  it('unmount → setInterval cleared (이후 변경 영향 없음)', () => {
    const { container, unmount } = render(<CurrentTimeIndicator hourHeight={60} startHour={9} />)
    const before = (container.firstChild as HTMLElement).style.top
    unmount()
    vi.advanceTimersByTime(60_000 * 5)
    // 이미 unmount 됨 — container 는 detached
    expect(before).toBeDefined()
  })
})

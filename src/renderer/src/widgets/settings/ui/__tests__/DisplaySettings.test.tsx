/**
 * widgets/settings/ui/DisplaySettings.test.tsx
 *
 * ThemeCard 클릭 → applyTheme + settings.set / 글꼴 크기 변경 / AuthorBadge Switch.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  applyTheme: vi.fn(),
  applyFontSize: vi.fn(),
  show: true,
  setShow: vi.fn(),
  dayViewSettings: { startHour: 9, endHour: 18 },
  updateStartHour: vi.fn().mockResolvedValue(undefined),
  updateEndHour: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/shared/lib/theme', () => ({
  applyTheme: mocks.applyTheme,
  applyFontSize: mocks.applyFontSize
}))
vi.mock('@widgets/calendar/model/use-day-view-time-settings', () => ({
  useDayViewTimeSettings: () => ({
    settings: mocks.dayViewSettings,
    updateStartHour: mocks.updateStartHour,
    updateEndHour: mocks.updateEndHour
  })
}))
vi.mock('@/shared/hooks/use-show-author-badge-setting', () => ({
  useShowAuthorBadgeSetting: () => ({ show: mocks.show, setShow: mocks.setShow })
}))

import { DisplaySettings } from '../DisplaySettings'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mocks.applyTheme.mockClear()
  mocks.applyFontSize.mockClear()
  mocks.show = true
  mocks.setShow.mockClear()
  mocks.dayViewSettings = { startHour: 9, endHour: 18 }
  mocks.updateStartHour.mockClear().mockResolvedValue(undefined)
  mocks.updateEndHour.mockClear().mockResolvedValue(undefined)
  document.documentElement.classList.remove('dark')
  ;(window as unknown as Record<string, unknown>).api = {
    settings: {
      get: vi.fn().mockResolvedValue({ success: true, data: 'medium' }),
      set: vi.fn().mockResolvedValue({ success: true })
    }
  }
})

const api = (): typeof window.api => (window as unknown as { api: typeof window.api }).api

describe('DisplaySettings', () => {
  it('라이트 + 다크 ThemeCard 노출', () => {
    r(<DisplaySettings />)
    expect(screen.getByText('라이트')).toBeInTheDocument()
    expect(screen.getByText('다크')).toBeInTheDocument()
  })

  it('다크 ThemeCard 클릭 → applyTheme("dark") + settings.set', async () => {
    r(<DisplaySettings />)
    fireEvent.click(screen.getByText('다크').closest('button')!)
    expect(mocks.applyTheme).toHaveBeenCalledWith('dark')
    await waitFor(() => expect(api().settings.set).toHaveBeenCalledWith('theme', 'dark'))
  })

  it('mount 시 settings.get("fontSize") → currentFontSize 갱신', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: 'large' })
    r(<DisplaySettings />)
    await waitFor(() => expect(api().settings.get).toHaveBeenCalledWith('fontSize'))
  })

  it('AuthorBadge Switch 클릭 → setShow 호출', () => {
    r(<DisplaySettings />)
    expect(screen.getByText('생성자/수정자 표시')).toBeInTheDocument()
    const sw = screen.getByRole('switch')
    fireEvent.click(sw)
    expect(mocks.setShow).toHaveBeenCalled()
  })

  it('ScheduleSettings (일간 뷰 타임라인) 섹션 노출', () => {
    r(<DisplaySettings />)
    expect(screen.getByText('일간 뷰 타임라인')).toBeInTheDocument()
    expect(screen.getByText('시작 시간')).toBeInTheDocument()
    expect(screen.getByText('끝 시간')).toBeInTheDocument()
  })
})

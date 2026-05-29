/**
 * app/providers/update-checker.test.tsx
 *
 * 1.5s 후 getVersion → lastVersion 비교 → isUpdate 면 changelog 탭 open + localStorage 저장.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  openTab: vi.fn(),
  getVersion: vi.fn()
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { openTab: typeof mocks.openTab }) => unknown) =>
    sel({ openTab: mocks.openTab })
}))

vi.mock('@shared/constants/tab-url', () => ({
  ROUTES: { CHANGELOG: '/changelog' }
}))

import { UpdateChecker } from '../update-checker'

beforeEach(() => {
  mocks.openTab.mockReset()
  mocks.getVersion.mockReset()
  localStorage.clear()
  ;(window as unknown as Record<string, unknown>).api = {
    appInfo: { getVersion: mocks.getVersion }
  }
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('UpdateChecker', () => {
  it('null 반환 (렌더 없음)', () => {
    mocks.getVersion.mockResolvedValue({ success: true, data: '1.0.0' })
    const { container } = render(<UpdateChecker />)
    expect(container.firstChild).toBeNull()
  })

  it('lastVersion 없음 + 현재 1.0.0 → isUpdate=false, openTab 호출 안 함', async () => {
    mocks.getVersion.mockResolvedValue({ success: true, data: '1.0.0' })
    render(<UpdateChecker />)
    await act(async () => {
      vi.advanceTimersByTime(1500)
      await Promise.resolve()
    })
    expect(mocks.openTab).not.toHaveBeenCalled()
    expect(localStorage.getItem('lastAppVersion')).toBe('1.0.0')
  })

  it('lastVersion 다름 → changelog 탭 open + localStorage 저장', async () => {
    localStorage.setItem('lastAppVersion', '1.0.0')
    mocks.getVersion.mockResolvedValue({ success: true, data: '1.1.0' })
    render(<UpdateChecker />)
    await act(async () => {
      vi.advanceTimersByTime(1500)
      await Promise.resolve()
    })
    expect(mocks.openTab).toHaveBeenCalledWith({
      type: 'changelog',
      pathname: '/changelog',
      title: '업데이트 내역'
    })
    expect(localStorage.getItem('lastAppVersion')).toBe('1.1.0')
  })

  it('getVersion 실패 → openTab 호출 안 함', async () => {
    mocks.getVersion.mockResolvedValue({ success: false })
    render(<UpdateChecker />)
    await act(async () => {
      vi.advanceTimersByTime(1500)
      await Promise.resolve()
    })
    expect(mocks.openTab).not.toHaveBeenCalled()
  })
})

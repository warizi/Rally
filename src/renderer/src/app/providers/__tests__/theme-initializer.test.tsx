/**
 * app/providers/theme-initializer.test.tsx
 *
 * settings.get → applyTheme + applyFontSize. data 없으면 호출 안 함.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  applyTheme: vi.fn(),
  applyFontSize: vi.fn(),
  themeResponse: { success: true, data: 'dark' } as unknown,
  fontResponse: { success: true, data: 'large' } as unknown
}))

vi.mock('@shared/lib/theme', () => ({
  applyTheme: mocks.applyTheme,
  applyFontSize: mocks.applyFontSize
}))

import { ThemeInitializer } from '../theme-initializer'

beforeEach(() => {
  mocks.applyTheme.mockClear()
  mocks.applyFontSize.mockClear()
  mocks.themeResponse = { success: true, data: 'dark' }
  mocks.fontResponse = { success: true, data: 'large' }
  ;(window as unknown as Record<string, unknown>).api = {
    settings: {
      get: vi.fn().mockImplementation(async (key: string) => {
        if (key === 'theme') return mocks.themeResponse
        if (key === 'fontSize') return mocks.fontResponse
        return { success: false }
      })
    }
  }
})

describe('ThemeInitializer', () => {
  it('null 컴포넌트', () => {
    const { container } = render(<ThemeInitializer />)
    expect(container.firstChild).toBeNull()
  })

  it('settings.get 성공 → applyTheme + applyFontSize 호출', async () => {
    render(<ThemeInitializer />)
    await waitFor(() => expect(mocks.applyTheme).toHaveBeenCalledWith('dark'))
    expect(mocks.applyFontSize).toHaveBeenCalledWith('large')
  })

  it('theme data 없음 → applyTheme 호출 안 함', async () => {
    mocks.themeResponse = { success: false }
    render(<ThemeInitializer />)
    await new Promise((r) => setTimeout(r, 20))
    expect(mocks.applyTheme).not.toHaveBeenCalled()
  })

  it('fontSize data 없음 → applyFontSize 호출 안 함', async () => {
    mocks.fontResponse = { success: true, data: null }
    render(<ThemeInitializer />)
    await new Promise((r) => setTimeout(r, 20))
    expect(mocks.applyFontSize).not.toHaveBeenCalled()
  })
})

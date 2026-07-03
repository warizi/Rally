/**
 * widgets/settings/ui/KeyboardShortcutsSettings.test.tsx
 *
 * 정적 read-only 문서 — 주요 텍스트 노출 검증 + OS별 표기 분기.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { __resetPlatformCacheForTest } from '@shared/lib/platform'
import { KeyboardShortcutsSettings } from '../KeyboardShortcutsSettings'

function setPlatform(platform: string): void {
  ;(window as unknown as { electron?: unknown }).electron = {
    process: { platform }
  }
}

beforeEach(() => {
  __resetPlatformCacheForTest()
})

afterEach(() => {
  delete (window as unknown as { electron?: unknown }).electron
  __resetPlatformCacheForTest()
})

describe('KeyboardShortcutsSettings', () => {
  it('타이틀 + 설명 노출 (macOS 전용 문구 없음)', () => {
    render(<KeyboardShortcutsSettings />)
    expect(screen.getByText('키보드 단축키')).toBeInTheDocument()
    expect(screen.queryByText(/macOS 만 지원하며/)).not.toBeInTheDocument()
    expect(screen.getByText(/포커스가 있을 때는 비활성화/)).toBeInTheDocument()
  })

  it('탭 레이아웃 그룹 + 3개 단축키 row', () => {
    render(<KeyboardShortcutsSettings />)
    expect(screen.getByText('탭 레이아웃')).toBeInTheDocument()
    expect(screen.getByText('Pane 이동')).toBeInTheDocument()
    expect(screen.getByText('탭 이동')).toBeInTheDocument()
    expect(screen.getByText('탭 스냅샷 전환')).toBeInTheDocument()
  })

  it('darwin — ⌘/⌥ 표기 + cmd/opt 설명', () => {
    setPlatform('darwin')
    render(<KeyboardShortcutsSettings />)
    expect(screen.getAllByText('⌘').length).toBeGreaterThan(0)
    expect(screen.getByText('⌥')).toBeInTheDocument()
    expect(screen.getByText(/cmd \+ opt 를 누른 상태/)).toBeInTheDocument()
    expect(screen.getByText(/cmd \+ shift \+ f 를 누르면 전체 검색/)).toBeInTheDocument()
  })

  it('win32 — Ctrl/Alt 표기 + ctrl/alt 설명', () => {
    setPlatform('win32')
    render(<KeyboardShortcutsSettings />)
    expect(screen.getAllByText('Ctrl').length).toBeGreaterThan(0)
    expect(screen.getByText('Alt')).toBeInTheDocument()
    expect(screen.getByText(/ctrl \+ alt 를 누른 상태/)).toBeInTheDocument()
    expect(screen.getByText(/ctrl \+ shift \+ f 를 누르면 전체 검색/)).toBeInTheDocument()
    expect(screen.queryByText('⌘')).not.toBeInTheDocument()
  })

  it('각 row 의 description 노출', () => {
    render(<KeyboardShortcutsSettings />)
    expect(screen.getByText(/ctrl \+ shift 를 누른 상태/)).toBeInTheDocument()
  })

  it('전체 검색 단축키 노출 — 편집 중에도 동작 안내 포함', () => {
    render(<KeyboardShortcutsSettings />)
    expect(screen.getByText('검색')).toBeInTheDocument()
    expect(screen.getByText('전체 검색')).toBeInTheDocument()
    expect(screen.getByText(/포커스가 있어도 동작/)).toBeInTheDocument()
  })
})

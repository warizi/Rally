/**
 * widgets/settings/ui/KeyboardShortcutsSettings.test.tsx
 *
 * 정적 read-only 문서 — 주요 텍스트 노출 검증.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KeyboardShortcutsSettings } from '../KeyboardShortcutsSettings'

describe('KeyboardShortcutsSettings', () => {
  it('타이틀 + 설명 노출', () => {
    render(<KeyboardShortcutsSettings />)
    expect(screen.getByText('키보드 단축키')).toBeInTheDocument()
    expect(screen.getByText(/macOS 만 지원하며/)).toBeInTheDocument()
  })

  it('탭 레이아웃 그룹 + 3개 단축키 row', () => {
    render(<KeyboardShortcutsSettings />)
    expect(screen.getByText('탭 레이아웃')).toBeInTheDocument()
    expect(screen.getByText('Pane 이동')).toBeInTheDocument()
    expect(screen.getByText('탭 이동')).toBeInTheDocument()
    expect(screen.getByText('탭 스냅샷 전환')).toBeInTheDocument()
  })

  it('각 row 의 description 노출', () => {
    render(<KeyboardShortcutsSettings />)
    expect(screen.getByText(/ctrl \+ shift 를 누른 상태/)).toBeInTheDocument()
    expect(screen.getByText(/cmd \+ opt 를 누른 상태/)).toBeInTheDocument()
  })
})

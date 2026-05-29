/**
 * widgets/settings/ui/SettingsDialog.test.tsx
 *
 * open 분기 + 7개 탭 노출 + 클릭 시 탭 전환.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../GeneralSettings', () => ({
  GeneralSettings: () => <div data-testid="settings-general" />
}))
vi.mock('../DisplaySettings', () => ({
  DisplaySettings: () => <div data-testid="settings-display" />
}))
vi.mock('../NoteSettings', () => ({
  NoteSettings: () => <div data-testid="settings-note" />
}))
vi.mock('../AlarmSettings', () => ({
  AlarmSettings: () => <div data-testid="settings-alarm" />
}))
vi.mock('../AISettings', () => ({
  AISettings: () => <div data-testid="settings-ai" />
}))
vi.mock('../TrashSettings', () => ({
  TrashSettings: () => <div data-testid="settings-trash" />
}))
vi.mock('../KeyboardShortcutsSettings', () => ({
  KeyboardShortcutsSettings: () => <div data-testid="settings-shortcuts" />
}))

import { SettingsDialog } from '../SettingsDialog'

describe('SettingsDialog', () => {
  it('open=false → 콘텐츠 미렌더', () => {
    render(<SettingsDialog open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByText('설정')).not.toBeInTheDocument()
  })

  it('open=true → 7개 탭 노출', () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText('설정')).toBeInTheDocument()
    for (const label of ['기본', '디스플레이', '노트', '알림', '단축키', '휴지통', 'AI (Claude)']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('초기 탭 = "기본" (GeneralSettings 렌더)', () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('settings-general')).toBeInTheDocument()
  })

  it('"디스플레이" 탭 클릭 → DisplaySettings 렌더', () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />)
    fireEvent.click(screen.getByText('디스플레이'))
    expect(screen.getByTestId('settings-display')).toBeInTheDocument()
    expect(screen.queryByTestId('settings-general')).not.toBeInTheDocument()
  })

  it('"AI (Claude)" 탭 클릭 → AISettings 렌더', () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />)
    fireEvent.click(screen.getByText('AI (Claude)'))
    expect(screen.getByTestId('settings-ai')).toBeInTheDocument()
  })
})

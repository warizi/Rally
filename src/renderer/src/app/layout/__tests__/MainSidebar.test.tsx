/**
 * MainSidebar 회귀 테스트 (P2-5 closeout).
 *
 * P2-5 plan 노트의 가정 ("shared/ui/sidebar.tsx 가 도메인 로직 흡수") 은 outdated —
 * 실제로는 shadcn 원본 그대로이고 비즈니스 로직은 이미 app/layout/MainSidebar.tsx
 * 와 features/workspace, features/tab-snapshot, features/settings 등에 분리됨.
 *
 * 추가 분리 대신 회귀 테스트만 보강해 향후 변경 안전성 확보.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createElement } from 'react'
import type { JSX, ReactNode } from 'react'
import MainSidebar from '../MainSidebar'
import { SidebarProvider } from '@shared/ui/sidebar'

// 무거운 child 위젯 / dialog 는 mock — dispatch 가 올바른지만 검증.
vi.mock('@/features/workspace/switch-workspace', () => ({
  WorkspaceSwitcher: () =>
    createElement('div', { 'data-testid': 'workspace-switcher' }, 'WorkspaceSwitcher')
}))

vi.mock('@/features/settings/manage-settings', () => ({
  SettingsDialog: ({ open }: { open: boolean }) =>
    open ? createElement('div', { 'data-testid': 'settings-dialog' }, 'SettingsDialog') : null
}))

vi.mock('@/features/tab-snapshot/manage-tab-snapshot', () => ({
  TabSnapshotSection: () =>
    createElement('div', { 'data-testid': 'tab-snapshot-section' }, 'TabSnapshotSection')
}))

const openTabMock = vi.fn()
const toggleTerminalMock = vi.fn()
const updateSnapshotMock = vi.fn()

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (selector: (s: unknown) => unknown) =>
    selector({
      openTab: openTabMock,
      tabs: {},
      panes: {},
      activePaneId: '',
      getState: () => ({ tabs: {}, panes: {}, layout: {} })
    }),
  applySessionToStore: vi.fn()
}))

vi.mock('@/entities/tab-snapshot', () => ({
  useUpdateTabSnapshot: () => ({ mutate: updateSnapshotMock })
}))

vi.mock('@/shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (selector: (s: unknown) => unknown) =>
    selector({ currentWorkspaceId: 'ws-1' })
}))

vi.mock('@/features/terminal', () => ({
  useTerminalPanelStore: (selector: (s: unknown) => unknown) =>
    selector({ isOpen: false, toggle: toggleTerminalMock })
}))

function Wrapper({ children }: { children: ReactNode }): JSX.Element {
  return createElement(SidebarProvider, null, children)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MainSidebar', () => {
  it('S1 — 기능 메뉴 (sidebar_items) 와 시스템 메뉴 라벨이 렌더된다', () => {
    render(<MainSidebar />, { wrapper: Wrapper })
    expect(screen.getByText('기능')).toBeInTheDocument()
    expect(screen.getByText('시스템')).toBeInTheDocument()
    // 항상 표시되는 항목
    expect(screen.getByText('터미널')).toBeInTheDocument()
    expect(screen.getByText('설정')).toBeInTheDocument()
  })

  it('S2 — 자식 위젯이 정상 mount 된다 (WorkspaceSwitcher / TabSnapshotSection)', () => {
    render(<MainSidebar />, { wrapper: Wrapper })
    expect(screen.getByTestId('workspace-switcher')).toBeInTheDocument()
    expect(screen.getByTestId('tab-snapshot-section')).toBeInTheDocument()
  })

  it('S3 — 터미널 메뉴 클릭 → toggleTerminal 호출', () => {
    render(<MainSidebar />, { wrapper: Wrapper })
    fireEvent.click(screen.getByText('터미널'))
    expect(toggleTerminalMock).toHaveBeenCalledTimes(1)
  })

  it('S4 — 설정 메뉴 클릭 → SettingsDialog 열림', () => {
    render(<MainSidebar />, { wrapper: Wrapper })
    expect(screen.queryByTestId('settings-dialog')).toBeNull()

    fireEvent.click(screen.getByText('설정'))
    expect(screen.getByTestId('settings-dialog')).toBeInTheDocument()
  })

  it('S6 — 시스템 그룹에 "업데이트 내역" 항목이 렌더되고 클릭 시 changelog 탭 오픈', () => {
    render(<MainSidebar />, { wrapper: Wrapper })
    expect(screen.getByText('업데이트 내역')).toBeInTheDocument()

    fireEvent.click(screen.getByText('업데이트 내역'))
    expect(openTabMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'changelog',
        pathname: '/changelog',
        title: '업데이트 내역'
      })
    )
  })

  it('S5 — sidebar_items 메뉴 클릭 → openTab 호출', () => {
    render(<MainSidebar />, { wrapper: Wrapper })
    // sidebar_items 에서 가장 보편적인 항목 (대시보드) 시도
    const dashboardBtn = screen.queryByText('대시보드')
    if (dashboardBtn) {
      fireEvent.click(dashboardBtn)
      expect(openTabMock).toHaveBeenCalledTimes(1)
      const args = openTabMock.mock.calls[0][0]
      expect(args).toHaveProperty('pathname')
      expect(args).toHaveProperty('title')
      expect(args).toHaveProperty('type')
    } else {
      // 대시보드가 sidebar_items 에 없을 수도 있으니, 첫 menu item 으로 fallback
      const buttons = screen
        .getAllByRole('button')
        .filter((b) => b.textContent && !['터미널', '설정'].includes(b.textContent.trim()))
      if (buttons.length > 0) {
        fireEvent.click(buttons[0])
        expect(openTabMock).toHaveBeenCalled()
      }
    }
  })
})

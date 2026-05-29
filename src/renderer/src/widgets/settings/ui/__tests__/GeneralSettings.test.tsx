/**
 * widgets/settings/ui/GeneralSettings.test.tsx
 *
 * 3 setting Switch + onboarding 초기화 (resetWelcome + resetChecklist).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  todoDateEnabled: false,
  setTodoDate: vi.fn(),
  showExt: false,
  setShowExt: vi.fn(),
  headerCollapsed: false,
  setHeaderCollapsed: vi.fn(),
  resetWelcome: vi.fn().mockResolvedValue(undefined),
  resetChecklist: vi.fn().mockResolvedValue(undefined),
  toastSuccess: vi.fn()
}))

vi.mock('@widgets/todo/model/use-todo-default-date-setting', () => ({
  useTodoDefaultDateSetting: () => ({
    enabled: mocks.todoDateEnabled,
    setEnabled: mocks.setTodoDate
  })
}))
vi.mock('@features/folder/manage-folder', () => ({
  useShowExtensionSetting: () => ({
    enabled: mocks.showExt,
    setEnabled: mocks.setShowExt
  })
}))
vi.mock('@shared/hooks/use-tab-header-collapsed-setting', () => ({
  useTabHeaderCollapsedSetting: () => ({
    collapsed: mocks.headerCollapsed,
    setCollapsed: mocks.setHeaderCollapsed
  })
}))
vi.mock('@shared/store/onboarding', () => ({
  useOnboardingStore: (
    sel: (s: {
      resetWelcome: typeof mocks.resetWelcome
      resetChecklist: typeof mocks.resetChecklist
    }) => unknown
  ) => sel({ resetWelcome: mocks.resetWelcome, resetChecklist: mocks.resetChecklist })
}))
vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess }
}))

import { GeneralSettings } from '../GeneralSettings'

beforeEach(() => {
  mocks.todoDateEnabled = false
  mocks.showExt = false
  mocks.headerCollapsed = false
  mocks.setTodoDate.mockClear()
  mocks.setShowExt.mockClear()
  mocks.setHeaderCollapsed.mockClear()
  mocks.resetWelcome.mockClear().mockResolvedValue(undefined)
  mocks.resetChecklist.mockClear().mockResolvedValue(undefined)
  mocks.toastSuccess.mockClear()
})

describe('GeneralSettings', () => {
  it('3 section + 4 control 노출', () => {
    render(<GeneralSettings />)
    expect(screen.getByText('할일')).toBeInTheDocument()
    expect(screen.getByText('파일 탐색기')).toBeInTheDocument()
    expect(screen.getByText('탭 헤더')).toBeInTheDocument()
    expect(screen.getByText('온보딩')).toBeInTheDocument()
    // 3 switches
    expect(screen.getAllByRole('switch')).toHaveLength(3)
  })

  it('각 Switch 클릭 → 대응 setter 호출', () => {
    render(<GeneralSettings />)
    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[0])
    expect(mocks.setTodoDate).toHaveBeenCalledWith(true)
    fireEvent.click(switches[1])
    expect(mocks.setShowExt).toHaveBeenCalledWith(true)
    fireEvent.click(switches[2])
    expect(mocks.setHeaderCollapsed).toHaveBeenCalledWith(true)
  })

  it('초기화 클릭 → 두 reset Promise + toast.success', async () => {
    render(<GeneralSettings />)
    fireEvent.click(screen.getByRole('button', { name: /초기화/ }))
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled())
    expect(mocks.resetWelcome).toHaveBeenCalled()
    expect(mocks.resetChecklist).toHaveBeenCalled()
  })
})

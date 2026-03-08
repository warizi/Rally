import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkspaceSwitcher } from '../WorkspaceSwitcher'
import { useWorkspaceSwitch } from '../../model/useWorkspaceSwitch'
import { SidebarProvider } from '@shared/ui/sidebar'
import { createElement } from 'react'
import type { JSX, ReactNode } from 'react'

vi.mock('../../model/useWorkspaceSwitch')

vi.mock('../CreateWorkspaceDialog', () => ({
  CreateWorkspaceDialog: ({ open }: { open: boolean }) =>
    open ? createElement('div', { 'data-testid': 'create-dialog' }, 'CreateDialog') : null
}))
vi.mock('../EditWorkspaceDialog', () => ({
  EditWorkspaceDialog: ({ open }: { open: boolean }) =>
    open ? createElement('div', { 'data-testid': 'edit-dialog' }, 'EditDialog') : null
}))
vi.mock('../DeleteWorkspaceDialog', () => ({
  DeleteWorkspaceDialog: ({ open, disabled }: { open: boolean; disabled: boolean }) =>
    open
      ? createElement(
          'div',
          { 'data-testid': 'delete-dialog', 'data-disabled': disabled },
          'DeleteDialog'
        )
      : null
}))

const ws1 = { id: 'ws-1', name: 'My Workspace', createdAt: new Date(), updatedAt: new Date() }
const ws2 = { id: 'ws-2', name: 'Other Workspace', createdAt: new Date(), updatedAt: new Date() }

const mockHandleSwitch = vi.fn()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReturn = (overrides: any = {}): any => ({
  workspaces: [ws1, ws2],
  currentWorkspaceId: 'ws-1',
  currentWorkspace: ws1,
  handleSwitch: mockHandleSwitch,
  handleCreated: vi.fn(),
  handleDeleted: vi.fn(),
  isLastWorkspace: false,
  ...overrides
})

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  return createElement(SidebarProvider, null, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useWorkspaceSwitch).mockReturnValue(mockReturn())
})

function openDropdown(): void {
  const trigger = document.querySelector('[data-sidebar="menu-button"]') as HTMLElement
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
  fireEvent.click(trigger)
}

describe('WorkspaceSwitcher', () => {
  describe('트리거 버튼', () => {
    it('현재 워크스페이스 이름이 표시된다', () => {
      render(<WorkspaceSwitcher />, { wrapper })

      expect(screen.getByText('My Workspace')).toBeInTheDocument()
    })

    it('현재 워크스페이스 이니셜이 표시된다', () => {
      render(<WorkspaceSwitcher />, { wrapper })

      expect(screen.getByText('M')).toBeInTheDocument()
    })

    it('현재 워크스페이스가 없으면 기본값이 표시된다', () => {
      vi.mocked(useWorkspaceSwitch).mockReturnValue(
        mockReturn({ currentWorkspace: undefined, currentWorkspaceId: null })
      )

      render(<WorkspaceSwitcher />, { wrapper })

      expect(screen.getByText('W')).toBeInTheDocument()
      expect(screen.getByText('워크스페이스')).toBeInTheDocument()
    })
  })

  describe('드롭다운 목록', () => {
    it('워크스페이스 목록이 표시된다', () => {
      render(<WorkspaceSwitcher />, { wrapper })
      openDropdown()

      // 'My Workspace'는 트리거 + 드롭다운 양쪽에 존재
      expect(screen.getAllByText('My Workspace')).toHaveLength(2)
      expect(screen.getByText('Other Workspace')).toBeInTheDocument()
    })

    it('현재 워크스페이스에 체크 아이콘이 표시된다', () => {
      render(<WorkspaceSwitcher />, { wrapper })
      openDropdown()

      // lucide Check svg는 aria-hidden이라 role로 접근
      const items = screen.getAllByRole('menuitem')
      const currentItem = items.find((el) => el.textContent?.includes('My Workspace'))
      expect(currentItem?.querySelector('svg')).toBeInTheDocument()
    })

    it('워크스페이스 클릭 시 handleSwitch가 호출된다', () => {
      render(<WorkspaceSwitcher />, { wrapper })
      openDropdown()

      fireEvent.click(screen.getByText('Other Workspace'))

      expect(mockHandleSwitch).toHaveBeenCalledWith('ws-2')
    })
  })

  describe('다이얼로그 열기', () => {
    it('워크스페이스 추가 클릭 시 CreateWorkspaceDialog가 열린다', () => {
      render(<WorkspaceSwitcher />, { wrapper })
      openDropdown()
      fireEvent.click(screen.getByText('워크스페이스 추가'))

      expect(screen.getByTestId('create-dialog')).toBeInTheDocument()
    })

    it('이름 변경 클릭 시 EditWorkspaceDialog가 열린다', () => {
      render(<WorkspaceSwitcher />, { wrapper })
      openDropdown()
      fireEvent.click(screen.getByText('이름 변경'))

      expect(screen.getByTestId('edit-dialog')).toBeInTheDocument()
    })

    it('워크스페이스 삭제 클릭 시 DeleteWorkspaceDialog가 열린다', () => {
      render(<WorkspaceSwitcher />, { wrapper })
      openDropdown()
      fireEvent.click(screen.getByText('워크스페이스 삭제'))

      expect(screen.getByTestId('delete-dialog')).toBeInTheDocument()
    })
  })

  describe('마지막 워크스페이스', () => {
    it('isLastWorkspace가 true이면 삭제 메뉴가 비활성화된다', () => {
      vi.mocked(useWorkspaceSwitch).mockReturnValue(mockReturn({ isLastWorkspace: true }))

      render(<WorkspaceSwitcher />, { wrapper })
      openDropdown()

      const deleteItem = screen.getByText('워크스페이스 삭제').closest('[role="menuitem"]')
      expect(deleteItem).toHaveAttribute('aria-disabled', 'true')
    })
  })
})

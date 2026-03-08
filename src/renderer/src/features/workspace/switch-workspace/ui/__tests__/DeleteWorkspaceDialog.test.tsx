import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeleteWorkspaceDialog } from '../DeleteWorkspaceDialog'
import { useDeleteWorkspace } from '@entities/workspace'
import type { Workspace } from '@entities/workspace'

vi.mock('@entities/workspace', () => ({
  useDeleteWorkspace: vi.fn()
}))

const mockMutate = vi.fn()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReturn = (isPending: boolean): any => ({ mutate: mockMutate, isPending })

const mockWorkspace: Workspace = {
  id: 'ws-1',
  name: 'My Workspace',
  path: '/test/path',
  createdAt: new Date(),
  updatedAt: new Date()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useDeleteWorkspace).mockReturnValue(mockReturn(false))
})

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  workspace: mockWorkspace,
  onDeleted: vi.fn(),
  disabled: false
}

describe('DeleteWorkspaceDialog', () => {
  it('워크스페이스 이름이 표시된다', () => {
    render(<DeleteWorkspaceDialog {...defaultProps} />)

    expect(screen.getByText('"My Workspace"')).toBeInTheDocument()
  })

  it('삭제 버튼 클릭 시 deleteWorkspace가 호출된다', async () => {
    render(<DeleteWorkspaceDialog {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: '삭제' }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith('ws-1', expect.any(Object))
    })
  })

  it('disabled가 true이면 삭제 버튼이 비활성화된다', () => {
    render(<DeleteWorkspaceDialog {...defaultProps} disabled={true} />)

    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled()
  })

  it('삭제 중에는 버튼이 비활성화된다', () => {
    vi.mocked(useDeleteWorkspace).mockReturnValue(mockReturn(true))

    render(<DeleteWorkspaceDialog {...defaultProps} />)

    expect(screen.getByRole('button', { name: '삭제 중...' })).toBeDisabled()
  })

  it('workspace가 null이면 삭제해도 mutate가 호출되지 않는다', async () => {
    render(<DeleteWorkspaceDialog {...defaultProps} workspace={null} />)

    fireEvent.click(screen.getByRole('button', { name: '삭제' }))

    await waitFor(() => {
      expect(mockMutate).not.toHaveBeenCalled()
    })
  })
})

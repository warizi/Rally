import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditWorkspaceDialog } from '../EditWorkspaceDialog'
import { useUpdateWorkspace } from '@entities/workspace'
import type { Workspace } from '@entities/workspace'

vi.mock('@entities/workspace', () => ({
  useUpdateWorkspace: vi.fn()
}))

const mockMutate = vi.fn()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReturn = (isPending: boolean): any => ({ mutate: mockMutate, isPending })

const mockWorkspace: Workspace = {
  id: 'ws-1',
  name: 'My Workspace',
  createdAt: new Date(),
  updatedAt: new Date()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useUpdateWorkspace).mockReturnValue(mockReturn(false))
})

describe('EditWorkspaceDialog', () => {
  it('현재 워크스페이스 이름이 입력 필드에 미리 채워진다', () => {
    render(<EditWorkspaceDialog open={true} onOpenChange={vi.fn()} workspace={mockWorkspace} />)

    expect(screen.getByDisplayValue('My Workspace')).toBeInTheDocument()
  })

  it('빈 이름으로 제출하면 유효성 검사 에러가 표시된다', async () => {
    render(<EditWorkspaceDialog open={true} onOpenChange={vi.fn()} workspace={mockWorkspace} />)

    fireEvent.change(screen.getByDisplayValue('My Workspace'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(screen.getByText('이름을 입력해주세요')).toBeInTheDocument()
    })
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('이름 변경 후 제출하면 updateWorkspace가 호출된다', async () => {
    render(<EditWorkspaceDialog open={true} onOpenChange={vi.fn()} workspace={mockWorkspace} />)

    fireEvent.change(screen.getByDisplayValue('My Workspace'), {
      target: { value: 'Updated Name' }
    })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { id: 'ws-1', name: 'Updated Name' },
        expect.any(Object)
      )
    })
  })

  it('취소 버튼 클릭 시 onOpenChange(false)가 호출된다', () => {
    const onOpenChange = vi.fn()
    render(
      <EditWorkspaceDialog open={true} onOpenChange={onOpenChange} workspace={mockWorkspace} />
    )

    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('저장 중에는 제출 버튼이 비활성화된다', () => {
    vi.mocked(useUpdateWorkspace).mockReturnValue(mockReturn(true))

    render(<EditWorkspaceDialog open={true} onOpenChange={vi.fn()} workspace={mockWorkspace} />)

    expect(screen.getByRole('button', { name: '저장 중...' })).toBeDisabled()
  })

  it('workspace가 null이면 제출해도 mutate가 호출되지 않는다', async () => {
    render(<EditWorkspaceDialog open={true} onOpenChange={vi.fn()} workspace={null} />)

    fireEvent.change(screen.getByPlaceholderText('워크스페이스 이름'), {
      target: { value: 'Some Name' }
    })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(mockMutate).not.toHaveBeenCalled()
    })
  })
})

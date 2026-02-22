import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateWorkspaceDialog } from '../CreateWorkspaceDialog'
import { useCreateWorkspace } from '@entities/workspace'

vi.mock('@entities/workspace', () => ({
  useCreateWorkspace: vi.fn()
}))

const mockMutate = vi.fn()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReturn = (isPending: boolean): any => ({ mutate: mockMutate, isPending })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCreateWorkspace).mockReturnValue(mockReturn(false))
})

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onCreated: vi.fn()
}

describe('CreateWorkspaceDialog', () => {
  it('열리면 입력 폼이 렌더링된다', () => {
    render(<CreateWorkspaceDialog {...defaultProps} />)

    expect(screen.getByPlaceholderText('워크스페이스 이름')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '생성' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
  })

  it('빈 이름으로 제출하면 유효성 검사 에러가 표시된다', async () => {
    render(<CreateWorkspaceDialog {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: '생성' }))

    await waitFor(() => {
      expect(screen.getByText('이름을 입력해주세요')).toBeInTheDocument()
    })
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('이름 입력 후 제출하면 createWorkspace가 호출된다', async () => {
    render(<CreateWorkspaceDialog {...defaultProps} />)

    fireEvent.change(screen.getByPlaceholderText('워크스페이스 이름'), {
      target: { value: 'New Workspace' }
    })
    fireEvent.click(screen.getByRole('button', { name: '생성' }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith('New Workspace', expect.any(Object))
    })
  })

  it('취소 버튼 클릭 시 onOpenChange(false)가 호출된다', () => {
    const onOpenChange = vi.fn()
    render(<CreateWorkspaceDialog {...defaultProps} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('생성 중에는 제출 버튼이 비활성화된다', () => {
    vi.mocked(useCreateWorkspace).mockReturnValue(mockReturn(true))

    render(<CreateWorkspaceDialog {...defaultProps} />)

    expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled()
  })
})

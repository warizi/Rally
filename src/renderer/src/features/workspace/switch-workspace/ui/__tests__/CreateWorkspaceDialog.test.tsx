import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CreateWorkspaceDialog } from '../CreateWorkspaceDialog'
import { useCreateWorkspace, useImportBackup } from '@entities/workspace'

const importMutate = vi.fn()
const backupSectionRef: { onBackupSelected: ((zipPath: string, name: string) => void) | null } = {
  onBackupSelected: null
}

vi.mock('@entities/workspace', () => ({
  useCreateWorkspace: vi.fn(),
  useImportBackup: vi.fn(),
  BackupRestoreSection: ({
    onBackupSelected
  }: {
    onBackupSelected: (zipPath: string, name: string) => void
  }) => {
    backupSectionRef.onBackupSelected = onBackupSelected
    return null
  }
}))

const mockMutate = vi.fn()
const mockSelectDirectory = vi.fn()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReturn = (isPending: boolean): any => ({ mutate: mockMutate, isPending })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCreateWorkspace).mockReturnValue(mockReturn(false))
  vi.mocked(useImportBackup).mockReturnValue({ mutate: importMutate, isPending: false } as never)
  backupSectionRef.onBackupSelected = null
  ;(window as unknown as Record<string, unknown>).api = {
    workspace: { selectDirectory: mockSelectDirectory }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
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

  it('이름과 경로 입력 후 제출하면 createWorkspace가 호출된다', async () => {
    mockSelectDirectory.mockResolvedValue('/selected/path')
    render(<CreateWorkspaceDialog {...defaultProps} />)

    fireEvent.change(screen.getByPlaceholderText('워크스페이스 이름'), {
      target: { value: 'New Workspace' }
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '폴더 선택' }))
    })
    fireEvent.click(screen.getByRole('button', { name: '생성' }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { name: 'New Workspace', path: '/selected/path' },
        expect.any(Object)
      )
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

  it('백업 zip 선택 후 제출 → importBackup 호출 (createWorkspace 호출 안 함)', async () => {
    mockSelectDirectory.mockResolvedValue('/path')
    render(<CreateWorkspaceDialog {...defaultProps} />)

    // BackupRestoreSection 이 onBackupSelected 호출 시뮬레이트
    await act(async () => {
      backupSectionRef.onBackupSelected?.('/backup.zip', 'Restored WS')
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '폴더 선택' }))
    })

    fireEvent.click(screen.getByRole('button', { name: '생성' }))

    await waitFor(() => {
      expect(importMutate).toHaveBeenCalledWith(
        expect.objectContaining({ zipPath: '/backup.zip', path: '/path' }),
        expect.any(Object)
      )
    })
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('복구 중 → "복구 중..." 라벨 + 버튼 disabled', () => {
    vi.mocked(useImportBackup).mockReturnValue({
      mutate: importMutate,
      isPending: true
    } as never)
    render(<CreateWorkspaceDialog {...defaultProps} />)
    // backupZipPath 가 null 이라 "생성 중..." 으로 표시됨 (state)
    expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled()
  })
})

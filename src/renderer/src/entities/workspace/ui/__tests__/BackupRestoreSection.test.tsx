/**
 * entities/workspace/ui/BackupRestoreSection.test.tsx
 *
 * 파일 선택 → onBackupSelected(path, workspaceName) / 초기 + clear 콜백.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BackupRestoreSection } from '../BackupRestoreSection'

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    backup: { selectFile: vi.fn(), readManifest: vi.fn() }
  }
  vi.clearAllMocks()
})

const api = (): typeof window.api => (window as unknown as { api: typeof window.api }).api

describe('BackupRestoreSection', () => {
  it('초기 → "선택" 버튼 노출', () => {
    render(<BackupRestoreSection onBackupSelected={vi.fn()} onBackupCleared={vi.fn()} />)
    expect(screen.getByRole('button', { name: /선택/ })).toBeInTheDocument()
  })

  it('파일 선택 취소 (null) → 콜백 호출 안 함', async () => {
    vi.mocked(api().backup.selectFile).mockResolvedValue(null)
    const onSelected = vi.fn()
    render(<BackupRestoreSection onBackupSelected={onSelected} onBackupCleared={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /선택/ }))
    await waitFor(() => expect(api().backup.selectFile).toHaveBeenCalled())
    expect(onSelected).not.toHaveBeenCalled()
  })

  it('파일 선택 + manifest 성공 → onBackupSelected 호출', async () => {
    vi.mocked(api().backup.selectFile).mockResolvedValue('/path/to/backup.zip')
    vi.mocked(api().backup.readManifest).mockResolvedValue({
      success: true,
      data: { workspaceName: 'My Workspace' } as never
    })
    const onSelected = vi.fn()
    render(<BackupRestoreSection onBackupSelected={onSelected} onBackupCleared={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /선택/ }))
    await waitFor(() =>
      expect(onSelected).toHaveBeenCalledWith('/path/to/backup.zip', 'My Workspace')
    )
    // 파일 이름이 input 에 노출 (basename)
    expect(screen.getByDisplayValue('backup.zip')).toBeInTheDocument()
  })

  it('파일 선택됨 → X 버튼 클릭 시 clear', async () => {
    vi.mocked(api().backup.selectFile).mockResolvedValue('/path/x.zip')
    vi.mocked(api().backup.readManifest).mockResolvedValue({
      success: true,
      data: { workspaceName: 'X' } as never
    })
    const onCleared = vi.fn()
    render(<BackupRestoreSection onBackupSelected={vi.fn()} onBackupCleared={onCleared} />)
    fireEvent.click(screen.getByRole('button', { name: /선택/ }))
    await waitFor(() => expect(screen.getByDisplayValue('x.zip')).toBeInTheDocument())
    // X 버튼은 단일 icon button — last button
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1])
    expect(onCleared).toHaveBeenCalled()
    expect(screen.getByPlaceholderText('백업 파일을 선택해주세요')).toHaveValue('')
  })

  it('manifest 실패 → onBackupSelected 호출 안 함 (file 표시는 됨)', async () => {
    vi.mocked(api().backup.selectFile).mockResolvedValue('/path/bad.zip')
    vi.mocked(api().backup.readManifest).mockResolvedValue({
      success: false,
      errorType: 'UnknownError',
      message: 'invalid'
    })
    const onSelected = vi.fn()
    render(<BackupRestoreSection onBackupSelected={onSelected} onBackupCleared={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /선택/ }))
    await waitFor(() => expect(screen.getByDisplayValue('bad.zip')).toBeInTheDocument())
    expect(onSelected).not.toHaveBeenCalled()
  })
})

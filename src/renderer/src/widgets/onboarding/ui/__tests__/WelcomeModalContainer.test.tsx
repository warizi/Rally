/**
 * widgets/onboarding/ui/WelcomeModalContainer.test.tsx
 *
 * handleCreateSample → window.api.onboarding.createSampleWorkspace 호출
 *  → 성공: setCurrentWorkspaceId + queryClient.invalidateQueries + toast.success
 *  → 실패: toast.error + throw.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  setCurrentWorkspaceId: vi.fn(),
  invalidateQueries: vi.fn(),
  createSampleWorkspace: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  receivedOnCreate: null as null | (() => Promise<void>)
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (
    selector: (s: { setCurrentWorkspaceId: typeof mocks.setCurrentWorkspaceId }) => unknown
  ) => selector({ setCurrentWorkspaceId: mocks.setCurrentWorkspaceId })
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries })
}))

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError }
}))

vi.mock('../WelcomeModal', () => ({
  WelcomeModal: ({ onCreateSample }: { onCreateSample?: () => Promise<void> }) => {
    mocks.receivedOnCreate = onCreateSample ?? null
    return (
      <button data-testid="trigger" onClick={() => onCreateSample?.().catch(() => {})}>
        trigger
      </button>
    )
  }
}))

import { WelcomeModalContainer } from '../WelcomeModalContainer'

beforeEach(() => {
  mocks.setCurrentWorkspaceId.mockReset()
  mocks.invalidateQueries.mockReset()
  mocks.createSampleWorkspace.mockReset()
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
  ;(window as unknown as Record<string, unknown>).api = {
    onboarding: { createSampleWorkspace: mocks.createSampleWorkspace }
  }
})

describe('WelcomeModalContainer', () => {
  it('WelcomeModal 렌더 + onCreateSample prop 주입', () => {
    render(<WelcomeModalContainer />)
    expect(screen.getByTestId('trigger')).toBeInTheDocument()
    expect(mocks.receivedOnCreate).toBeTypeOf('function')
  })

  it('성공 → invalidateQueries + setCurrentWorkspaceId + toast.success', async () => {
    mocks.createSampleWorkspace.mockResolvedValue({
      success: true,
      data: { workspaceId: 'ws-new' }
    })
    render(<WelcomeModalContainer />)
    fireEvent.click(screen.getByTestId('trigger'))
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled())
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['workspaces'] })
    expect(mocks.setCurrentWorkspaceId).toHaveBeenCalledWith('ws-new')
  })

  it('실패 → toast.error + throw', async () => {
    mocks.createSampleWorkspace.mockResolvedValue({
      success: false,
      message: 'oops'
    })
    render(<WelcomeModalContainer />)
    fireEvent.click(screen.getByTestId('trigger'))
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('oops'))
    expect(mocks.setCurrentWorkspaceId).not.toHaveBeenCalled()
  })

  it('실패 + message 없음 → 기본 메시지', async () => {
    mocks.createSampleWorkspace.mockResolvedValue({ success: false })
    render(<WelcomeModalContainer />)
    fireEvent.click(screen.getByTestId('trigger'))
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('샘플 워크스페이스를 만들 수 없어요')
    )
  })
})

/**
 * widgets/onboarding/ui/WelcomeModal.test.tsx
 *
 * hydrated + isEmpty + !welcomeDismissed + workspaceId → open.
 * 슬라이드 인디케이터 + prev/next 네비게이션.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  hydrated: true,
  welcomeDismissed: false,
  dismissWelcome: vi.fn(),
  isEmpty: true,
  isLoadingEmptiness: false
}))

vi.mock('@shared/store/onboarding', () => ({
  useOnboardingStore: (
    sel: (s: {
      hydrated: boolean
      welcomeDismissed: boolean
      dismissWelcome: typeof mocks.dismissWelcome
    }) => unknown
  ) =>
    sel({
      hydrated: mocks.hydrated,
      welcomeDismissed: mocks.welcomeDismissed,
      dismissWelcome: mocks.dismissWelcome
    })
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))

vi.mock('@/widgets/workspace', () => ({
  useWorkspaceIsEmpty: () => ({ isEmpty: mocks.isEmpty, isLoading: mocks.isLoadingEmptiness })
}))

vi.mock('@shared/lib/logger', () => ({
  toLogError: () => () => {}
}))

vi.mock('../WelcomeSlides', () => ({
  WelcomeSlide: ({ index }: { index: number }) => <div data-testid="slide">slide-{index}</div>
}))

import { WelcomeModal } from '../WelcomeModal'

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.hydrated = true
  mocks.welcomeDismissed = false
  mocks.isEmpty = true
  mocks.isLoadingEmptiness = false
  mocks.dismissWelcome.mockReset()
})

describe('WelcomeModal', () => {
  it('모든 조건 충족 → 모달 열리고 첫 슬라이드 노출', () => {
    render(<WelcomeModal />)
    expect(screen.getByTestId('slide')).toHaveTextContent('slide-0')
  })

  it('hydrated=false → 모달 미열림', () => {
    mocks.hydrated = false
    render(<WelcomeModal />)
    expect(screen.queryByTestId('slide')).not.toBeInTheDocument()
  })

  it('welcomeDismissed=true → 모달 미열림', () => {
    mocks.welcomeDismissed = true
    render(<WelcomeModal />)
    expect(screen.queryByTestId('slide')).not.toBeInTheDocument()
  })

  it('isEmpty=false → 모달 미열림', () => {
    mocks.isEmpty = false
    render(<WelcomeModal />)
    expect(screen.queryByTestId('slide')).not.toBeInTheDocument()
  })

  it('workspaceId=null → 모달 미열림', () => {
    mocks.workspaceId = null
    render(<WelcomeModal />)
    expect(screen.queryByTestId('slide')).not.toBeInTheDocument()
  })

  it('isLoadingEmptiness → 모달 미열림', () => {
    mocks.isLoadingEmptiness = true
    render(<WelcomeModal />)
    expect(screen.queryByTestId('slide')).not.toBeInTheDocument()
  })

  it('다음 버튼 클릭 → slide 인덱스 증가', () => {
    render(<WelcomeModal />)
    expect(screen.getByTestId('slide')).toHaveTextContent('slide-0')
    fireEvent.click(screen.getByRole('button', { name: /다음/ }))
    expect(screen.getByTestId('slide')).toHaveTextContent('slide-1')
  })

  it('첫 슬라이드 → 이전 버튼 disabled', () => {
    render(<WelcomeModal />)
    expect(screen.getByRole('button', { name: /이전/ })).toBeDisabled()
  })

  it('마지막 슬라이드 → "샘플 워크스페이스 만들기" 버튼 노출', () => {
    render(<WelcomeModal />)
    fireEvent.click(screen.getByRole('button', { name: /다음/ }))
    fireEvent.click(screen.getByRole('button', { name: /다음/ }))
    expect(screen.getByText(/샘플 워크스페이스 만들기/)).toBeInTheDocument()
    expect(screen.getByText(/빈 워크스페이스로 시작/)).toBeInTheDocument()
  })

  it('이전 → slide 감소', () => {
    render(<WelcomeModal />)
    fireEvent.click(screen.getByRole('button', { name: /다음/ }))
    expect(screen.getByTestId('slide')).toHaveTextContent('slide-1')
    fireEvent.click(screen.getByRole('button', { name: /이전/ }))
    expect(screen.getByTestId('slide')).toHaveTextContent('slide-0')
  })

  it('"빈 워크스페이스로 시작" 클릭 → dismissWelcome 호출', async () => {
    mocks.dismissWelcome.mockResolvedValue(undefined)
    render(<WelcomeModal />)
    fireEvent.click(screen.getByRole('button', { name: /다음/ }))
    fireEvent.click(screen.getByRole('button', { name: /다음/ }))
    fireEvent.click(screen.getByRole('button', { name: /빈 워크스페이스로 시작/ }))
    await waitFor(() => {
      expect(mocks.dismissWelcome).toHaveBeenCalled()
    })
  })

  it('"샘플 워크스페이스 만들기" 클릭 → onCreateSample + dismissWelcome 호출', async () => {
    mocks.dismissWelcome.mockResolvedValue(undefined)
    const onCreateSample = vi.fn().mockResolvedValue(undefined)
    render(<WelcomeModal onCreateSample={onCreateSample} />)
    fireEvent.click(screen.getByRole('button', { name: /다음/ }))
    fireEvent.click(screen.getByRole('button', { name: /다음/ }))
    fireEvent.click(screen.getByRole('button', { name: /샘플 워크스페이스 만들기/ }))
    await waitFor(() => {
      expect(onCreateSample).toHaveBeenCalled()
      expect(mocks.dismissWelcome).toHaveBeenCalled()
    })
  })
})

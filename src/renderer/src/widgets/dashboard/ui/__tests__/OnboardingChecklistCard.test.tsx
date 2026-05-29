/**
 * widgets/dashboard/ui/OnboardingChecklistCard.test.tsx
 *
 * hydrated/acknowledged 분기 + 체크리스트 행 + 닫기 + step 클릭 → openTab.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  hydrated: true,
  acknowledged: false,
  progress: {} as Record<string, boolean>,
  acknowledge: vi.fn().mockResolvedValue(undefined),
  openTab: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock('@shared/store/onboarding', () => ({
  CHECKLIST_STEPS: [
    { id: 'first_note', label: '첫 노트', pathname: '/folder' },
    { id: 'first_todo', label: '첫 할 일', pathname: '/todo' }
  ],
  selectChecklistCounts: ({
    checklistProgress
  }: {
    checklistProgress: Record<string, boolean>
  }) => {
    const total = 2
    const done = Object.values(checklistProgress).filter(Boolean).length
    return { total, done, isAllDone: done === total }
  },
  useOnboardingStore: (
    sel: (s: {
      hydrated: boolean
      checklistAcknowledged: boolean
      checklistProgress: Record<string, boolean>
      acknowledgeChecklist: typeof mocks.acknowledge
    }) => unknown
  ) =>
    sel({
      hydrated: mocks.hydrated,
      checklistAcknowledged: mocks.acknowledged,
      checklistProgress: mocks.progress,
      acknowledgeChecklist: mocks.acknowledge
    })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { openTab: typeof mocks.openTab }) => unknown) =>
    sel({ openTab: mocks.openTab })
}))
vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess }
}))

import { OnboardingChecklistCard } from '../OnboardingChecklistCard'

beforeEach(() => {
  mocks.hydrated = true
  mocks.acknowledged = false
  mocks.progress = {}
  mocks.acknowledge.mockClear().mockResolvedValue(undefined)
  mocks.openTab.mockClear()
  mocks.toastSuccess.mockClear()
})

describe('OnboardingChecklistCard', () => {
  it('hydrated=false → null', () => {
    mocks.hydrated = false
    const { container } = render(<OnboardingChecklistCard />)
    expect(container.firstChild).toBeNull()
  })

  it('acknowledged=true → null', () => {
    mocks.acknowledged = true
    const { container } = render(<OnboardingChecklistCard />)
    expect(container.firstChild).toBeNull()
  })

  it('기본 → "시작하기" 타이틀 + checklist row', () => {
    render(<OnboardingChecklistCard />)
    expect(screen.getByText('시작하기')).toBeInTheDocument()
    expect(screen.getByText('첫 노트')).toBeInTheDocument()
    expect(screen.getByText('첫 할 일')).toBeInTheDocument()
  })

  it('isAllDone → "🎉 다 끝났어요" + toast.success 호출', () => {
    mocks.progress = { first_note: true, first_todo: true }
    render(<OnboardingChecklistCard />)
    expect(screen.getByText('🎉 다 끝났어요')).toBeInTheDocument()
    expect(mocks.toastSuccess).toHaveBeenCalled()
  })

  it('checklist 행 클릭 → openTab', () => {
    render(<OnboardingChecklistCard />)
    fireEvent.click(screen.getByText('첫 노트'))
    expect(mocks.openTab).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'folder', pathname: '/folder' })
    )
  })

  it('닫기 (X) 버튼 클릭 → acknowledgeChecklist', () => {
    render(<OnboardingChecklistCard />)
    // X 버튼은 title="이 위젯 숨기기"
    fireEvent.click(screen.getByTitle('이 위젯 숨기기'))
    expect(mocks.acknowledge).toHaveBeenCalled()
  })

  it('진행률 표시 (1/2)', () => {
    mocks.progress = { first_note: true }
    render(<OnboardingChecklistCard />)
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })
})

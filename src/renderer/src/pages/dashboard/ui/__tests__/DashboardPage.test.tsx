/**
 * pages/dashboard/ui/DashboardPage.test.tsx
 *
 * workspaceId 없음 / isEmpty / 정상 — 3개 분기 + 모든 widget mock.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@shared/ui/tooltip'
import type { ReactElement } from 'react'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  )
}

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  isEmpty: false,
  isLoading: false
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@/widgets/workspace', () => ({
  useWorkspaceIsEmpty: () => ({ isEmpty: mocks.isEmpty, isLoading: mocks.isLoading })
}))

// 모든 widget 들을 stub 으로 mock (DashboardPage 자체 분기 검증만)
vi.mock('@widgets/todo/ui/CreateTodoDialog', () => ({
  CreateTodoDialog: ({ trigger }: { trigger: React.ReactNode }) => <div>{trigger}</div>
}))
vi.mock('@widgets/calendar', () => ({
  ScheduleFormDialog: ({ trigger }: { trigger: React.ReactNode }) => <div>{trigger}</div>
}))
vi.mock('@widgets/dashboard', () => ({
  TodoStatsCard: () => <div data-testid="todo-stats" />,
  TodoChartCard: () => <div data-testid="todo-chart" />,
  NoteChartCard: () => <div data-testid="note-chart" />,
  UpcomingTodoCard: () => <div data-testid="upcoming-todo" />,
  TodayScheduleCard: () => <div data-testid="today-schedule" />,
  RecentNotesCard: () => <div data-testid="recent-notes" />,
  RecentCanvasCard: () => <div data-testid="recent-canvas" />,
  FileOverviewCard: () => <div data-testid="file-overview" />,
  QuickActionsCard: () => <div data-testid="quick-actions" />,
  OnboardingChecklistCard: () => <div data-testid="onboarding-checklist" />
}))

import { DashboardPage } from '../DashboardPage'

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.isEmpty = false
  mocks.isLoading = false
})

describe('DashboardPage', () => {
  it('workspaceId 없음 → "워크스페이스를 선택해주세요"', () => {
    mocks.workspaceId = null
    r(<DashboardPage />)
    expect(screen.getByText('워크스페이스를 선택해주세요.')).toBeInTheDocument()
  })

  it('isEmpty=true → 빈 워크스페이스 안내 + 할 일/일정 만들기 버튼', () => {
    mocks.isEmpty = true
    r(<DashboardPage />)
    expect(screen.getByText('아직 데이터가 없어요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /할 일 만들기/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /일정 만들기/ })).toBeInTheDocument()
  })

  it('정상 → 모든 dashboard widget 노출', () => {
    r(<DashboardPage />)
    for (const tid of [
      'onboarding-checklist',
      'todo-chart',
      'todo-stats',
      'upcoming-todo',
      'today-schedule',
      'quick-actions',
      'note-chart',
      'recent-notes',
      'recent-canvas',
      'file-overview'
    ]) {
      expect(screen.getByTestId(tid)).toBeInTheDocument()
    }
  })
})

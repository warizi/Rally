/**
 * features/todo/manage-recurring/ui/ManageRecurringDialog.test.tsx
 *
 * 룰 목록 노출 + 빈 상태 + 형식 (formatRecurrence/formatPeriod).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  rules: [] as Array<{
    id: string
    title: string
    priority: 'high' | 'medium' | 'low'
    recurrenceType: 'daily' | 'weekday' | 'weekend' | 'custom'
    daysOfWeek: number[] | null
    startDate: Date
    endDate: Date | null
    startTime: string | null
    endTime: string | null
  }>,
  deleteMutate: vi.fn()
}))

vi.mock('@entities/recurring-rule', () => ({
  useRecurringRulesByWorkspace: () => ({ data: mocks.rules }),
  useDeleteRecurringRule: () => ({ mutate: mocks.deleteMutate })
}))
vi.mock('../RecurringRuleFormDialog', () => ({
  RecurringRuleFormDialog: ({ open, mode }: { open: boolean; mode: string }) =>
    open ? <div data-testid="form-dialog" data-mode={mode} /> : null
}))

import { ManageRecurringDialog } from '../ManageRecurringDialog'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mocks.rules = []
  mocks.deleteMutate.mockClear()
})

describe('ManageRecurringDialog', () => {
  it('open=false → 콘텐츠 미렌더', () => {
    r(<ManageRecurringDialog workspaceId="ws-1" open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByText('반복 할일 관리')).not.toBeInTheDocument()
  })

  it('open=true + rules 0개 → "등록된 반복 할일이 없습니다"', () => {
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText('등록된 반복 할일이 없습니다')).toBeInTheDocument()
  })

  it('rules 있음 → 제목 노출 + 우선순위 라벨', () => {
    mocks.rules = [
      {
        id: 'r-1',
        title: '운동',
        priority: 'high',
        recurrenceType: 'daily',
        daysOfWeek: null,
        startDate: new Date('2026-05-01'),
        endDate: null,
        startTime: null,
        endTime: null
      }
    ]
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText('운동')).toBeInTheDocument()
    expect(screen.getByText('높음')).toBeInTheDocument()
    expect(screen.getByText('매일')).toBeInTheDocument()
  })

  it('custom + daysOfWeek → "매주 X, Y" 형식', () => {
    mocks.rules = [
      {
        id: 'r-1',
        title: '미팅',
        priority: 'medium',
        recurrenceType: 'custom',
        daysOfWeek: [1, 3, 5],
        startDate: new Date('2026-05-01'),
        endDate: null,
        startTime: null,
        endTime: null
      }
    ]
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText('매주 월, 수, 금')).toBeInTheDocument()
  })

  it('startTime/endTime 있으면 시간 노출', () => {
    mocks.rules = [
      {
        id: 'r-1',
        title: '운동',
        priority: 'medium',
        recurrenceType: 'daily',
        daysOfWeek: null,
        startDate: new Date('2026-05-01'),
        endDate: null,
        startTime: '06:00',
        endTime: '07:00'
      }
    ]
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText(/06:00.*~.*07:00/)).toBeInTheDocument()
  })

  it('endDate 있으면 ~ 사이 범위로 표시', () => {
    mocks.rules = [
      {
        id: 'r-1',
        title: '운동',
        priority: 'medium',
        recurrenceType: 'daily',
        daysOfWeek: null,
        startDate: new Date('2026-05-01'),
        endDate: new Date('2026-05-31'),
        startTime: null,
        endTime: null
      }
    ]
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    // 2026. 5. 1. ~ 2026. 5. 31.
    expect(screen.getByText(/~/)).toBeInTheDocument()
  })

  it('priority="low" → "낮음" 라벨 노출', () => {
    mocks.rules = [
      {
        id: 'r-low',
        title: '저우선',
        priority: 'low',
        recurrenceType: 'daily',
        daysOfWeek: null,
        startDate: new Date('2026-05-01'),
        endDate: null,
        startTime: null,
        endTime: null
      }
    ]
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText('낮음')).toBeInTheDocument()
  })

  it('weekday 타입 → 평일 라벨 (RECURRENCE_TYPE_LABELS)', () => {
    mocks.rules = [
      {
        id: 'r-wd',
        title: '평일',
        priority: 'medium',
        recurrenceType: 'weekday',
        daysOfWeek: null,
        startDate: new Date('2026-05-01'),
        endDate: null,
        startTime: null,
        endTime: null
      }
    ]
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText('평일')).toBeInTheDocument()
  })

  it('weekend 타입 → 주말 라벨', () => {
    mocks.rules = [
      {
        id: 'r-we',
        title: '주말',
        priority: 'medium',
        recurrenceType: 'weekend',
        daysOfWeek: null,
        startDate: new Date('2026-05-01'),
        endDate: null,
        startTime: null,
        endTime: null
      }
    ]
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText('주말')).toBeInTheDocument()
  })

  it('endTime만 있고 startTime null → 시간 미노출', () => {
    mocks.rules = [
      {
        id: 'r-no-time',
        title: '시간없음',
        priority: 'medium',
        recurrenceType: 'daily',
        daysOfWeek: null,
        startDate: new Date('2026-05-01'),
        endDate: null,
        startTime: null,
        endTime: null
      }
    ]
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    // 시간 (HH:mm) 패턴이 노출되지 않음
    expect(screen.queryByText(/\d{2}:\d{2}.*~.*\d{2}:\d{2}/)).toBeNull()
  })

  it('startTime 있고 endTime null → startTime 만 노출', () => {
    mocks.rules = [
      {
        id: 'r-start-only',
        title: '시작만',
        priority: 'medium',
        recurrenceType: 'daily',
        daysOfWeek: null,
        startDate: new Date('2026-05-01'),
        endDate: null,
        startTime: '08:00',
        endTime: null
      }
    ]
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText(/08:00/)).toBeInTheDocument()
    // ~ 가 시간 사이에 안 들어감 (07:00 ~ 08:00 같은 형식 없음)
    expect(screen.queryByText(/\d{2}:\d{2}\s*~\s*\d{2}:\d{2}/)).toBeNull()
  })

  it('custom + daysOfWeek 빈 배열 → "매주" 만 노출', () => {
    mocks.rules = [
      {
        id: 'r-no-days',
        title: 'NoDays',
        priority: 'medium',
        recurrenceType: 'custom',
        daysOfWeek: [],
        startDate: new Date('2026-05-01'),
        endDate: null,
        startTime: null,
        endTime: null
      }
    ]
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText(/매주/)).toBeInTheDocument()
  })

  it('"+ 새 반복 할일" 버튼 노출 (트리거)', () => {
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /새 반복 할일/ })).toBeInTheDocument()
  })

  it('rules 2개 → 2개 모두 노출', () => {
    mocks.rules = [
      {
        id: 'r-1',
        title: '운동',
        priority: 'high',
        recurrenceType: 'daily',
        daysOfWeek: null,
        startDate: new Date('2026-05-01'),
        endDate: null,
        startTime: null,
        endTime: null
      },
      {
        id: 'r-2',
        title: '독서',
        priority: 'low',
        recurrenceType: 'weekend',
        daysOfWeek: null,
        startDate: new Date('2026-05-01'),
        endDate: null,
        startTime: null,
        endTime: null
      }
    ]
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText('운동')).toBeInTheDocument()
    expect(screen.getByText('독서')).toBeInTheDocument()
  })

  it('custom + 모든 요일 (0~6) → 요일 7개 모두 노출', () => {
    mocks.rules = [
      {
        id: 'r-all-days',
        title: 'AllDays',
        priority: 'medium',
        recurrenceType: 'custom',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDate: new Date('2026-05-01'),
        endDate: null,
        startTime: null,
        endTime: null
      }
    ]
    r(<ManageRecurringDialog workspaceId="ws-1" open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText(/매주.*일.*월.*화.*수.*목.*금.*토/)).toBeInTheDocument()
  })
})

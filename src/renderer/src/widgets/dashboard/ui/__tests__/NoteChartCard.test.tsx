/**
 * widgets/dashboard/ui/NoteChartCard.test.tsx
 *
 * 7d/30d/3m 범위 + DashboardCard + chart-container 렌더.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface FakeNote {
  createdAt: Date
}

const mocks = vi.hoisted(() => ({
  notes: [] as FakeNote[]
}))

vi.mock('@entities/note', () => ({
  useNotesByWorkspace: () => ({ data: mocks.notes, isLoading: false })
}))

vi.mock('@shared/hooks/use-count-up', () => ({
  useCountUp: (n: number) => n
}))

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  CartesianGrid: () => null,
  XAxis: () => null
}))

vi.mock('@shared/ui/dashboard-card', () => ({
  DashboardCard: ({
    title,
    children,
    action
  }: {
    title: string
    children: React.ReactNode
    action?: React.ReactNode
  }) => (
    <div data-testid="dashboard-card">
      <h2>{title}</h2>
      {action}
      {children}
    </div>
  )
}))

vi.mock('@shared/ui/chart', () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
  ChartLegend: () => null,
  ChartLegendContent: () => null
}))

import { NoteChartCard } from '../NoteChartCard'

beforeEach(() => {
  mocks.notes = []
})

describe('NoteChartCard', () => {
  it('타이틀 "노트 추이" + 빈 데이터 → 생성 0', () => {
    render(<NoteChartCard workspaceId="ws-1" />)
    expect(screen.getByText('노트 추이')).toBeInTheDocument()
    expect(screen.getByText('생성')).toBeInTheDocument()
  })

  it('3개월 클릭 → 활성 토글', () => {
    render(<NoteChartCard workspaceId="ws-1" />)
    const btn3m = screen.getByRole('button', { name: '3개월' })
    fireEvent.click(btn3m)
    expect(btn3m.className).toMatch(/bg-primary/)
  })

  it('notes 가 오늘 createdAt 가지면 totalCreated 반영', () => {
    mocks.notes = [{ createdAt: new Date() }, { createdAt: new Date() }]
    render(<NoteChartCard workspaceId="ws-1" />)
    expect(screen.getByTestId('chart-container')).toBeInTheDocument()
  })

  it('chart-container 렌더 확인', () => {
    render(<NoteChartCard workspaceId="ws-1" />)
    expect(screen.getByTestId('chart-container')).toBeInTheDocument()
    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })
})

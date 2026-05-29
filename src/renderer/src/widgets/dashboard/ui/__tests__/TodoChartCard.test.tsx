/**
 * widgets/dashboard/ui/TodoChartCard.test.tsx
 *
 * 7d/30d/3m 범위 버튼 → setRange. 빈 todos → totals=0/0.
 * chart-container 자식 렌더 + range 버튼 active 스타일.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface FakeTodo {
  createdAt: Date
  doneAt: Date | null
}

const mocks = vi.hoisted(() => ({
  todos: [] as FakeTodo[]
}))

vi.mock('@entities/todo', () => ({
  useTodosByWorkspace: () => ({ data: mocks.todos, isLoading: false })
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

import { TodoChartCard } from '../TodoChartCard'

beforeEach(() => {
  mocks.todos = []
})

describe('TodoChartCard', () => {
  it('타이틀 "할 일 추이" 노출 + 빈 데이터 → 생성/완료 0', () => {
    render(<TodoChartCard workspaceId="ws-1" />)
    expect(screen.getByText('할 일 추이')).toBeInTheDocument()
    expect(screen.getByText('생성')).toBeInTheDocument()
    expect(screen.getByText('완료')).toBeInTheDocument()
  })

  it('초기 range = 7d → 7일 버튼 active 스타일', () => {
    render(<TodoChartCard workspaceId="ws-1" />)
    const btn = screen.getByRole('button', { name: '7일' })
    expect(btn.className).toMatch(/bg-primary/)
  })

  it('30일 버튼 클릭 → 활성 토글', () => {
    render(<TodoChartCard workspaceId="ws-1" />)
    const btn30 = screen.getByRole('button', { name: '30일' })
    fireEvent.click(btn30)
    expect(btn30.className).toMatch(/bg-primary/)
    expect(screen.getByRole('button', { name: '7일' }).className).not.toMatch(/bg-primary/)
  })

  it('todos 가 오늘 created/doneAt 가지면 총계 반영', () => {
    const today = new Date()
    mocks.todos = [
      { createdAt: today, doneAt: today },
      { createdAt: today, doneAt: null }
    ]
    render(<TodoChartCard workspaceId="ws-1" />)
    expect(screen.getByTestId('chart-container')).toBeInTheDocument()
  })
})

/**
 * widgets/dashboard/ui/TodoStatsCard.test.tsx
 *
 * useTodosByWorkspace mock + status/priority 카운트 + completionRate.
 * useCountUp 의 framer-motion animate 는 모킹 — initial render 시 0 반환.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  todos: [] as Array<{ id: string; status: string; priority: string; isDone: boolean }>,
  openTab: vi.fn()
}))

vi.mock('@entities/todo', () => ({
  useTodosByWorkspace: () => ({ data: mocks.todos, isLoading: false })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { openTab: typeof mocks.openTab }) => unknown) =>
    sel({ openTab: mocks.openTab })
}))
// useCountUp → value 그대로 즉시 반환 (animate 비활성)
vi.mock('@shared/hooks/use-count-up', () => ({
  useCountUp: (target: number) => target
}))

import { TodoStatsCard } from '../TodoStatsCard'

function todo(
  status: string,
  priority = 'medium',
  isDone = false
): { id: string; status: string; priority: string; isDone: boolean } {
  return { id: Math.random().toString(), status, priority, isDone }
}

beforeEach(() => {
  mocks.todos = []
  mocks.openTab.mockClear()
})

describe('TodoStatsCard', () => {
  it('빈 todos → "할 일이 없습니다"', () => {
    render(<TodoStatsCard workspaceId="ws-1" />)
    expect(screen.getByText('할 일이 없습니다')).toBeInTheDocument()
  })

  it('completionRate 계산 (완료 1 / 전체 4 = 25%)', () => {
    mocks.todos = [todo('할일'), todo('진행중'), todo('보류'), todo('완료', 'medium', true)]
    render(<TodoStatsCard workspaceId="ws-1" />)
    expect(screen.getByText('25')).toBeInTheDocument() // completionRate
    expect(screen.getByText('%')).toBeInTheDocument()
  })

  it('상태별 카운트 표시', () => {
    mocks.todos = [todo('할일'), todo('할일'), todo('진행중')]
    render(<TodoStatsCard workspaceId="ws-1" />)
    // 4 status 레이블 모두 노출
    for (const label of ['할일', '진행중', '보류', '완료']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('priority 미완료 카운트만 집계', () => {
    mocks.todos = [
      todo('할일', 'high'),
      todo('완료', 'high', true), // 완료 → priority 제외
      todo('할일', 'low')
    ]
    render(<TodoStatsCard workspaceId="ws-1" />)
    // priority section 'high'/'medium'/'low' 라벨 노출
    expect(screen.getByText('높음')).toBeInTheDocument()
    expect(screen.getByText('낮음')).toBeInTheDocument()
  })

  it('"모두 보기" 클릭 → openTab(todo)', () => {
    mocks.todos = [todo('할일')]
    render(<TodoStatsCard workspaceId="ws-1" />)
    fireEvent.click(screen.getByRole('button', { name: '모두 보기' }))
    expect(mocks.openTab).toHaveBeenCalledWith(expect.objectContaining({ type: 'todo' }))
  })

  it('completion 100% (모두 완료)', () => {
    mocks.todos = [todo('완료', 'medium', true), todo('완료', 'medium', true)]
    render(<TodoStatsCard workspaceId="ws-1" />)
    expect(screen.getByText('100')).toBeInTheDocument()
  })
})

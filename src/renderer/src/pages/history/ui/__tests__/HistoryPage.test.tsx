/**
 * pages/history/ui/HistoryPage.test.tsx
 *
 * workspace 분기 + 검색/날짜 필터 + 초기화 버튼.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@shared/ui/tooltip'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@/widgets/history-timeline', () => ({
  HistoryTimeline: ({
    workspaceId,
    query,
    fromDate,
    toDate
  }: {
    workspaceId: string
    query: string
    fromDate: string | null
    toDate: string | null
  }) => (
    <div
      data-testid="history-timeline"
      data-ws={workspaceId}
      data-q={query}
      data-from={fromDate ?? ''}
      data-to={toDate ?? ''}
    />
  )
}))

import { HistoryPage } from '../HistoryPage'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
})

describe('HistoryPage', () => {
  it('workspaceId 없음 → 안내 문구', () => {
    mocks.workspaceId = null
    r(<HistoryPage />)
    expect(screen.getByText('워크스페이스를 선택해주세요')).toBeInTheDocument()
  })

  it('workspaceId 있음 → HistoryTimeline 렌더 + workspaceId 전달', () => {
    r(<HistoryPage />)
    expect(screen.getByTestId('history-timeline')).toHaveAttribute('data-ws', 'ws-1')
  })

  it('초기에는 query 빈값 + 초기화 버튼 미노출', () => {
    r(<HistoryPage />)
    expect(screen.getByTestId('history-timeline')).toHaveAttribute('data-q', '')
    expect(screen.queryByRole('button', { name: /초기화/ })).not.toBeInTheDocument()
  })

  it('검색 입력 → 초기화 버튼 노출', () => {
    r(<HistoryPage />)
    const input = screen.getByPlaceholderText(/검색/)
    fireEvent.change(input, { target: { value: 'foo' } })
    expect(screen.getByRole('button', { name: /초기화/ })).toBeInTheDocument()
  })

  it('초기화 클릭 → 검색 빈값 + 버튼 사라짐', () => {
    r(<HistoryPage />)
    const input = screen.getByPlaceholderText(/검색/)
    fireEvent.change(input, { target: { value: 'foo' } })
    fireEvent.click(screen.getByRole('button', { name: /초기화/ }))
    expect(input).toHaveValue('')
    expect(screen.queryByRole('button', { name: /초기화/ })).not.toBeInTheDocument()
  })
})

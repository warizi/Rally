/**
 * pages/csv/ui/CsvPage.test.tsx
 *
 * NotePage 동일 패턴 — csvId/workspaceId 빈값/loading/error/success.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  data: undefined as { content: string; encoding: string; columnWidths: string | null } | undefined,
  isLoading: false,
  isError: false,
  setTabError: vi.fn()
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@entities/csv-file', () => ({
  useReadCsvContent: () => ({
    data: mocks.data,
    isLoading: mocks.isLoading,
    isError: mocks.isError
  })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { setTabError: typeof mocks.setTabError }) => unknown) =>
    sel({ setTabError: mocks.setTabError })
}))
vi.mock('@widgets/csv-viewer', () => ({
  CsvHeader: ({ csvId, encoding }: { csvId: string; encoding: string }) => (
    <div data-testid="csv-header" data-csv={csvId} data-enc={encoding} />
  ),
  CsvViewer: ({ csvId, initialContent }: { csvId: string; initialContent: string }) => (
    <div data-testid="csv-viewer" data-csv={csvId} data-content={initialContent} />
  )
}))

import { CsvPage } from '../CsvPage'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.data = { content: 'a,b', encoding: 'UTF-8', columnWidths: null }
  mocks.isLoading = false
  mocks.isError = false
  mocks.setTabError.mockClear()
})

describe('CsvPage', () => {
  it('csvId 없음 → "테이블 정보가 없습니다"', () => {
    r(<CsvPage params={{}} />)
    expect(screen.getByText('테이블 정보가 없습니다.')).toBeInTheDocument()
  })

  it('isLoading=true → viewer 미렌더', () => {
    mocks.isLoading = true
    r(<CsvPage params={{ csvId: 'c-1' }} />)
    expect(screen.queryByTestId('csv-viewer')).not.toBeInTheDocument()
  })

  it('isError → 에러 메시지 + setTabError', () => {
    mocks.isError = true
    r(<CsvPage tabId="t-1" params={{ csvId: 'c-1' }} />)
    expect(screen.getByText('테이블 불러오기를 실패하였습니다.')).toBeInTheDocument()
    expect(mocks.setTabError).toHaveBeenCalledWith('t-1', true)
  })

  it('성공 → CsvViewer + content/encoding 전달', () => {
    mocks.data = { content: '1,2', encoding: 'EUC-KR', columnWidths: null }
    r(<CsvPage params={{ csvId: 'c-1' }} />)
    expect(screen.getByTestId('csv-viewer')).toHaveAttribute('data-content', '1,2')
    expect(screen.getByTestId('csv-header')).toHaveAttribute('data-enc', 'EUC-KR')
  })
})

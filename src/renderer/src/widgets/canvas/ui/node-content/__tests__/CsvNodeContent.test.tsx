/**
 * widgets/canvas/ui/node-content/CsvNodeContent.test.tsx
 *
 * NoteNodeContent 와 동일 패턴 — useReadCsvContent + CsvViewer.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  data: undefined as { content: string; columnWidths: string | null } | undefined,
  isLoading: false
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@entities/csv-file', () => ({
  useReadCsvContent: () => ({ data: mocks.data, isLoading: mocks.isLoading })
}))
vi.mock('@features/csv/edit-csv', () => ({
  CsvViewer: ({ csvId, initialContent }: { csvId: string; initialContent: string }) => (
    <div data-testid="csv-viewer" data-csv={csvId} data-content={initialContent} />
  )
}))

import { CsvNodeContent } from '../CsvNodeContent'
import type { NodeContentProps } from '../../../model/node-content-registry'

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.data = { content: 'a,b', columnWidths: null }
  mocks.isLoading = false
})

describe('CsvNodeContent', () => {
  it('isLoading=true → "불러오는 중..."', () => {
    mocks.isLoading = true
    render(<CsvNodeContent {...({ refId: 'c-1' } as unknown as NodeContentProps)} />)
    expect(screen.getByText('불러오는 중...')).toBeInTheDocument()
  })

  it('성공 → CsvViewer 렌더 + content 전달', () => {
    render(<CsvNodeContent {...({ refId: 'c-1' } as unknown as NodeContentProps)} />)
    expect(screen.getByTestId('csv-viewer')).toHaveAttribute('data-content', 'a,b')
  })

  it('data 없으면 빈 content', () => {
    mocks.data = undefined
    render(<CsvNodeContent {...({ refId: 'c-1' } as unknown as NodeContentProps)} />)
    expect(screen.getByTestId('csv-viewer')).toHaveAttribute('data-content', '')
  })
})

/**
 * widgets/dashboard/ui/RecentNotesCard.test.tsx
 *
 * RecentCanvasCard 와 동일 패턴. AuthorBadge 도 함께 렌더.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import type { RenderResult } from '@testing-library/react'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const mocks = vi.hoisted(() => ({
  notes: [] as Array<{
    id: string
    title: string
    updatedAt: Date
    updatedBy: string
    updatedById: string | null
    preview: string | null
  }>,
  openTab: vi.fn()
}))

vi.mock('@entities/note', () => ({
  useNotesByWorkspace: () => ({ data: mocks.notes, isLoading: false })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { openTab: typeof mocks.openTab }) => unknown) =>
    sel({ openTab: mocks.openTab })
}))

import { RecentNotesCard } from '../RecentNotesCard'

beforeEach(() => {
  mocks.notes = []
  mocks.openTab.mockClear()
})

describe('RecentNotesCard', () => {
  it('빈 목록 → "노트가 없습니다"', () => {
    r(<RecentNotesCard workspaceId="ws-1" />)
    expect(screen.getByText('노트가 없습니다')).toBeInTheDocument()
  })

  it('노트 N개 → 제목 모두 노출 (최대 5)', () => {
    mocks.notes = Array.from({ length: 6 }, (_, i) => ({
      id: `n${i}`,
      title: `Note ${i}`,
      updatedAt: new Date(`2026-05-0${i + 1}`),
      updatedBy: 'user',
      updatedById: null,
      preview: null
    }))
    r(<RecentNotesCard workspaceId="ws-1" />)
    // 최신순 정렬되면 Note 5/4/3/2/1 만 (Note 0 빠짐)
    expect(screen.queryByText('Note 0')).not.toBeInTheDocument()
    expect(screen.getByText('Note 5')).toBeInTheDocument()
  })

  it('preview 있으면 노출', () => {
    mocks.notes = [
      {
        id: 'n1',
        title: 'X',
        updatedAt: new Date(),
        updatedBy: 'user',
        updatedById: null,
        preview: '미리보기 텍스트'
      }
    ]
    r(<RecentNotesCard workspaceId="ws-1" />)
    expect(screen.getByText('미리보기 텍스트')).toBeInTheDocument()
  })

  it('노트 클릭 → openTab(note)', () => {
    mocks.notes = [
      {
        id: 'n1',
        title: 'Click me',
        updatedAt: new Date(),
        updatedBy: 'user',
        updatedById: null,
        preview: null
      }
    ]
    r(<RecentNotesCard workspaceId="ws-1" />)
    fireEvent.click(screen.getByText('Click me'))
    expect(mocks.openTab).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'note', title: 'Click me' })
    )
  })

  it('모두 보기 → openTab(folder)', () => {
    mocks.notes = [
      {
        id: 'n',
        title: 'x',
        updatedAt: new Date(),
        updatedBy: 'user',
        updatedById: null,
        preview: null
      }
    ]
    r(<RecentNotesCard workspaceId="ws-1" />)
    fireEvent.click(screen.getByRole('button', { name: '모두 보기' }))
    expect(mocks.openTab).toHaveBeenCalledWith(expect.objectContaining({ type: 'folder' }))
  })
})

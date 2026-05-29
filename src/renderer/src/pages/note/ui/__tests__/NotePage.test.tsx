/**
 * pages/note/ui/NotePage.test.tsx
 *
 * noteId/workspaceId 빈값 → "노트 정보가 없습니다" / isLoading → 헤더 로딩 /
 * isError → 에러 화면 + setTabError 호출 / 성공 → NoteEditor 렌더.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  data: undefined as string | undefined,
  isLoading: false,
  isError: false,
  setTabError: vi.fn()
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@entities/note', () => ({
  useReadNoteContent: () => ({
    data: mocks.data,
    isLoading: mocks.isLoading,
    isError: mocks.isError
  })
}))
vi.mock('@features/note/edit-note', () => ({
  NoteEditor: ({ noteId, initialContent }: { noteId: string; initialContent: string }) => (
    <div data-testid="note-editor" data-note={noteId} data-content={initialContent} />
  )
}))
vi.mock('@widgets/note-editor', () => ({
  NoteHeader: ({ noteId }: { noteId: string }) => (
    <div data-testid="note-header" data-note={noteId} />
  )
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { setTabError: typeof mocks.setTabError }) => unknown) =>
    sel({ setTabError: mocks.setTabError })
}))

import { NotePage } from '../NotePage'

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.data = 'note body'
  mocks.isLoading = false
  mocks.isError = false
  mocks.setTabError.mockClear()
})

describe('NotePage', () => {
  it('noteId 없음 → "노트 정보가 없습니다"', () => {
    r(<NotePage params={{}} />)
    expect(screen.getByText('노트 정보가 없습니다.')).toBeInTheDocument()
  })

  it('workspaceId 없음 → "노트 정보가 없습니다"', () => {
    mocks.workspaceId = null
    r(<NotePage params={{ noteId: 'n-1' }} />)
    expect(screen.getByText('노트 정보가 없습니다.')).toBeInTheDocument()
  })

  it('isLoading=true → header 로딩 (NoteEditor 미렌더)', () => {
    mocks.isLoading = true
    r(<NotePage params={{ noteId: 'n-1' }} />)
    expect(screen.queryByTestId('note-editor')).not.toBeInTheDocument()
  })

  it('isError=true → 에러 메시지 + setTabError 호출', () => {
    mocks.isError = true
    r(<NotePage tabId="tab-1" params={{ noteId: 'n-1' }} />)
    expect(screen.getByText('노트 불러오기를 실패하였습니다.')).toBeInTheDocument()
    expect(mocks.setTabError).toHaveBeenCalledWith('tab-1', true)
  })

  it('isError 인데 tabId 없음 → setTabError 호출 안 함', () => {
    mocks.isError = true
    r(<NotePage params={{ noteId: 'n-1' }} />)
    expect(mocks.setTabError).not.toHaveBeenCalled()
  })

  it('성공 → NoteEditor 렌더 + content 전달', () => {
    mocks.data = 'hello world'
    r(<NotePage params={{ noteId: 'n-1' }} />)
    const editor = screen.getByTestId('note-editor')
    expect(editor).toHaveAttribute('data-note', 'n-1')
    expect(editor).toHaveAttribute('data-content', 'hello world')
    expect(screen.getByTestId('note-header')).toBeInTheDocument()
  })

  it('성공 + content undefined → 빈 문자열로 fallback', () => {
    mocks.data = undefined
    r(<NotePage params={{ noteId: 'n-1' }} />)
    expect(screen.getByTestId('note-editor')).toHaveAttribute('data-content', '')
  })
})

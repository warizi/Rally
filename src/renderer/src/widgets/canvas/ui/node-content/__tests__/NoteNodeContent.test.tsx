/**
 * widgets/canvas/ui/node-content/NoteNodeContent.test.tsx
 *
 * useReadNoteContent isLoading 분기 + 성공 시 NoteEditor mount.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  content: undefined as string | undefined,
  isLoading: false
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@entities/note', () => ({
  useReadNoteContent: () => ({ data: mocks.content, isLoading: mocks.isLoading })
}))
vi.mock('@features/note/edit-note', () => ({
  NoteEditor: ({ noteId, initialContent }: { noteId: string; initialContent: string }) => (
    <div data-testid="note-editor" data-note={noteId} data-content={initialContent} />
  )
}))

import { NoteNodeContent } from '../NoteNodeContent'
import type { NodeContentProps } from '../../../model/node-content-registry'

function props(refId: string | null = 'n-1'): NodeContentProps {
  return { refId } as unknown as NodeContentProps
}

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.content = 'note body'
  mocks.isLoading = false
})

describe('NoteNodeContent', () => {
  it('isLoading=true → "불러오는 중..."', () => {
    mocks.isLoading = true
    render(<NoteNodeContent {...props()} />)
    expect(screen.getByText('불러오는 중...')).toBeInTheDocument()
  })

  it('성공 → NoteEditor 렌더 + content 전달', () => {
    render(<NoteNodeContent {...props()} />)
    const editor = screen.getByTestId('note-editor')
    expect(editor).toHaveAttribute('data-note', 'n-1')
    expect(editor).toHaveAttribute('data-content', 'note body')
  })

  it('refId null → 빈 string 전달', () => {
    render(<NoteNodeContent {...props(null)} />)
    expect(screen.getByTestId('note-editor')).toHaveAttribute('data-note', '')
  })
})

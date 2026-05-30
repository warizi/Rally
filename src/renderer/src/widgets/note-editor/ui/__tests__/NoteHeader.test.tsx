/**
 * widgets/note-editor/ui/NoteHeader.test.tsx
 *
 * note 매칭 → title/description prop 전달. onTitleChange → renameNote + setTabTitle.
 * onDescriptionChange → updateMeta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

interface FakeNote {
  id: string
  title: string
  description?: string
  createdBy?: string
  createdById?: string
  createdAt?: number
  updatedBy?: string
  updatedById?: string
  updatedAt?: number
}

const mocks = vi.hoisted(() => ({
  notes: [] as FakeNote[],
  content: '',
  renameNote: vi.fn(),
  updateMeta: vi.fn(),
  writeContent: vi.fn(),
  setTabTitle: vi.fn(),
  receivedProps: null as null | {
    title: string
    description: string
    onTitleChange: (title: string) => void
    onDescriptionChange: (d: string) => void
    footer?: React.ReactNode
    editable?: boolean
  }
}))

vi.mock('@entities/note', () => ({
  useNotesByWorkspace: () => ({ data: mocks.notes }),
  useReadNoteContent: () => ({ data: mocks.content }),
  useRenameNote: () => ({ mutate: mocks.renameNote }),
  useUpdateNoteMeta: () => ({ mutate: mocks.updateMeta }),
  useWriteNoteContent: () => ({ mutate: mocks.writeContent })
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { setTabTitle: typeof mocks.setTabTitle }) => unknown) =>
    sel({ setTabTitle: mocks.setTabTitle })
}))

vi.mock('@/widgets/entity-link', () => ({
  LinkedEntityPopoverButton: () => <div data-testid="entity-link" />
}))

vi.mock('@/widgets/tag', () => ({
  TagList: () => <div data-testid="tag-list" />
}))

vi.mock('@/widgets/template', () => ({
  TemplateButton: () => <div data-testid="template-btn" />
}))

vi.mock('@shared/ui/onboarding-tip', () => ({
  OnboardingTipIcon: () => <div data-testid="tip" />
}))

vi.mock('@shared/ui/author-badge', () => ({
  AuthorBadgePair: () => <div data-testid="author-pair" />
}))

vi.mock('@shared/ui/tab-header', () => ({
  default: (props: {
    title: string
    description: string
    onTitleChange?: (t: string) => void
    onDescriptionChange?: (d: string) => void
  }) => {
    mocks.receivedProps = props as typeof mocks.receivedProps
    return <div data-testid="tab-header" />
  }
}))

import { NoteHeader } from '../NoteHeader'

beforeEach(() => {
  mocks.notes = []
  mocks.content = ''
  mocks.renameNote.mockReset()
  mocks.updateMeta.mockReset()
  mocks.writeContent.mockReset()
  mocks.setTabTitle.mockReset()
  mocks.receivedProps = null
})

describe('NoteHeader', () => {
  it('TabHeader 렌더 + note 없음 → 빈 title/description', () => {
    render(<NoteHeader workspaceId="ws" noteId="n1" />)
    expect(mocks.receivedProps?.title).toBe('')
    expect(mocks.receivedProps?.description).toBe('')
  })

  it('note 있음 → title/description prop 전달', () => {
    mocks.notes = [{ id: 'n1', title: 'My Note', description: 'desc' }]
    render(<NoteHeader workspaceId="ws" noteId="n1" />)
    expect(mocks.receivedProps?.title).toBe('My Note')
    expect(mocks.receivedProps?.description).toBe('desc')
  })

  it('onTitleChange → renameNote + tabId 있으면 setTabTitle', () => {
    render(<NoteHeader workspaceId="ws" noteId="n1" tabId="tab-a" />)
    mocks.receivedProps?.onTitleChange('newTitle')
    expect(mocks.renameNote).toHaveBeenCalledWith({
      workspaceId: 'ws',
      noteId: 'n1',
      newName: 'newTitle'
    })
    expect(mocks.setTabTitle).toHaveBeenCalledWith('tab-a', 'newTitle')
  })

  it('tabId 없음 → setTabTitle 호출 안 함', () => {
    render(<NoteHeader workspaceId="ws" noteId="n1" />)
    mocks.receivedProps?.onTitleChange('newTitle')
    expect(mocks.setTabTitle).not.toHaveBeenCalled()
  })

  it('onDescriptionChange → updateMeta', () => {
    render(<NoteHeader workspaceId="ws" noteId="n1" />)
    mocks.receivedProps?.onDescriptionChange('New desc')
    expect(mocks.updateMeta).toHaveBeenCalledWith({
      workspaceId: 'ws',
      noteId: 'n1',
      data: { description: 'New desc' }
    })
  })

  it('note 있음 → footer prop 전달 (AuthorBadgePair smoke)', () => {
    mocks.notes = [
      {
        id: 'n1',
        title: 'T',
        description: 'd',
        createdBy: 'u',
        createdAt: 0,
        updatedBy: 'u',
        updatedAt: 0
      }
    ]
    render(<NoteHeader workspaceId="ws" noteId="n1" />)
    expect(mocks.receivedProps?.footer).toBeTruthy()
  })

  it('editable prop true 전달', () => {
    render(<NoteHeader workspaceId="ws" noteId="n1" />)
    expect(mocks.receivedProps?.editable).toBe(true)
  })
})

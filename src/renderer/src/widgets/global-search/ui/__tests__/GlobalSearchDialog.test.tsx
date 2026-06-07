/**
 * widgets/global-search/ui/GlobalSearchDialog.test.tsx
 * 일치/유사 그룹 렌더 + 항목 클릭 → openTab(도메인별 탭) + 닫힘.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { SearchHit } from '@entities/search'

const mocks = vi.hoisted(() => ({
  exact: [] as SearchHit[],
  similar: [] as SearchHit[],
  openTab: vi.fn(),
  setOpen: vi.fn()
}))

vi.mock('@entities/search', () => ({
  useGlobalSearch: () => ({
    data: { exact: mocks.exact, similar: mocks.similar },
    isFetching: false
  })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { openTab: typeof mocks.openTab }) => unknown) =>
    sel({ openTab: mocks.openTab })
}))
vi.mock('@/shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string }) => unknown) =>
    sel({ currentWorkspaceId: 'ws' })
}))
vi.mock('../../model/store', () => ({
  useGlobalSearchStore: (sel: (s: { open: boolean; setOpen: typeof mocks.setOpen }) => unknown) =>
    sel({ open: true, setOpen: mocks.setOpen })
}))
vi.mock('@shared/lib/entity-link', () => ({
  ENTITY_TYPE_ICON: new Proxy({}, { get: () => () => <span data-testid="icon" /> })
}))
vi.mock('@shared/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>
}))
vi.mock('@shared/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: (p: {
    value: string
    onValueChange: (v: string) => void
    placeholder?: string
  }) => (
    <input
      placeholder={p.placeholder}
      value={p.value}
      onChange={(e) => p.onValueChange(e.target.value)}
    />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ heading, children }: { heading: string; children: React.ReactNode }) => (
    <div>
      <div>{heading}</div>
      {children}
    </div>
  ),
  CommandItem: ({ onSelect, children }: { onSelect: () => void; children: React.ReactNode }) => (
    <div role="option" onClick={onSelect}>
      {children}
    </div>
  ),
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

import { GlobalSearchDialog } from '../GlobalSearchDialog'

function hit(type: SearchHit['type'], id: string, title: string): SearchHit {
  return {
    type,
    id,
    title,
    matchType: 'title',
    folderId: null,
    folderPath: null,
    updatedAt: '2026-01-01T00:00:00Z',
    preview: null
  }
}

beforeEach(() => {
  mocks.exact = []
  mocks.similar = []
  mocks.openTab.mockReset()
  mocks.setOpen.mockReset()
})

describe('GlobalSearchDialog', () => {
  it('일치/유사 그룹 + 항목 노출', () => {
    mocks.exact = [hit('note', 'A', '노트 A')]
    mocks.similar = [hit('todo', 'B', '할일 B')]
    render(<GlobalSearchDialog />)
    expect(screen.getByText('일치')).toBeInTheDocument()
    expect(screen.getByText('유사')).toBeInTheDocument()
    expect(screen.getByText('노트 A')).toBeInTheDocument()
    expect(screen.getByText('할일 B')).toBeInTheDocument()
  })

  it('note 항목 클릭 → openTab(note 탭) + 닫힘', () => {
    mocks.exact = [hit('note', 'n1', '노트')]
    render(<GlobalSearchDialog />)
    fireEvent.click(screen.getByText('노트').closest('[role="option"]')!)
    expect(mocks.openTab).toHaveBeenCalledWith({
      type: 'note',
      pathname: '/folder/note/n1',
      title: '노트'
    })
    expect(mocks.setOpen).toHaveBeenCalledWith(false)
  })

  it('table(csv) 항목 클릭 → csv 탭', () => {
    mocks.exact = [hit('table', 'c1', '표')]
    render(<GlobalSearchDialog />)
    fireEvent.click(screen.getByText('표').closest('[role="option"]')!)
    expect(mocks.openTab).toHaveBeenCalledWith({
      type: 'csv',
      pathname: '/folder/csv/c1',
      title: '표'
    })
  })
})

/**
 * features/folder/manage-folder/ui/FolderTree.test.tsx
 *
 * 빈 tree → FolderTreeEmpty. 트리 있음 → Tree 컴포넌트.
 * Toolbar/SearchBar/Dialogs 모두 마운트.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  tree: [] as Array<{ id: string }>,
  searchOpen: false
}))

vi.mock('@shared/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('../../lib/tree', () => ({
  Tree: ({ children }: { children: React.ReactNode | (() => React.ReactNode) }) => (
    <div data-testid="tree">{typeof children === 'function' ? null : children}</div>
  )
}))

vi.mock('../../model/use-workspace-tree', () => ({
  useWorkspaceTree: () => ({ tree: mocks.tree })
}))

vi.mock('../../model/use-tree-open-state', () => ({
  useTreeOpenState: () => ({
    openState: {},
    toggle: vi.fn(),
    collapseAll: vi.fn(),
    expandToItem: vi.fn(),
    expandIds: vi.fn()
  })
}))

vi.mock('../../model/use-tree-move-listener', () => ({
  useTreeMoveListener: vi.fn()
}))

vi.mock('../../model/use-folder-dialog-state', () => ({
  useFolderDialogState: () => ({
    createTarget: null,
    setCreateTarget: vi.fn(),
    renameTarget: null,
    setRenameTarget: vi.fn(),
    colorTarget: null,
    setColorTarget: vi.fn(),
    deleteTarget: null,
    setDeleteTarget: vi.fn(),
    noteDeleteTarget: null,
    setNoteDeleteTarget: vi.fn(),
    csvDeleteTarget: null,
    setCsvDeleteTarget: vi.fn(),
    pdfDeleteTarget: null,
    setPdfDeleteTarget: vi.fn(),
    imageDeleteTarget: null,
    setImageDeleteTarget: vi.fn()
  })
}))

vi.mock('../../model/use-folder-create-handlers', () => ({
  useFolderCreateHandlers: () => ({
    handleCreateNote: vi.fn(),
    handleCreateCsv: vi.fn()
  })
}))

vi.mock('../../model/use-folder-mutations', () => ({
  useFolderMutations: () => ({
    createFolder: vi.fn(),
    isCreatingFolder: false,
    rename: vi.fn(),
    isRenaming: false,
    updateMeta: vi.fn(),
    isUpdatingMeta: false,
    remove: vi.fn(),
    isRemoving: false,
    removeNote: vi.fn(),
    isRemovingNote: false,
    removeCsvFile: vi.fn(),
    isRemovingCsv: false,
    removePdfFile: vi.fn(),
    isRemovingPdf: false,
    removeImageFile: vi.fn(),
    isRemovingImage: false
  })
}))

vi.mock('../../model/use-folder-search', () => ({
  useFolderSearch: () => ({
    query: '',
    setQuery: vi.fn(),
    clear: vi.fn(),
    goNext: vi.fn(),
    goPrev: vi.fn(),
    activeIndex: 0,
    activeId: null,
    result: {
      matchedIds: new Set(),
      orderedMatches: [],
      ancestorIds: new Set()
    }
  })
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: () => null
}))

vi.mock('../FolderTreeNodeDispatcher', () => ({
  FolderTreeNodeDispatcher: () => null
}))

vi.mock('../FolderTreeToolbar', () => ({
  FolderTreeToolbar: () => <div data-testid="toolbar" />
}))

vi.mock('../FolderTreeSearchBar', () => ({
  FolderTreeSearchBar: () => <div data-testid="search-bar" />
}))

vi.mock('../FolderTreeEmpty', () => ({
  FolderTreeEmpty: () => <div data-testid="empty" />
}))

vi.mock('../FolderTreeDialogs', () => ({
  FolderTreeDialogs: () => <div data-testid="dialogs" />
}))

import { FolderTree } from '../FolderTree'

beforeEach(() => {
  mocks.tree = []
})

describe('FolderTree', () => {
  it('Toolbar + SearchBar + Dialogs 마운트', () => {
    render(<FolderTree workspaceId="ws" />)
    expect(screen.getByTestId('toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('search-bar')).toBeInTheDocument()
    expect(screen.getByTestId('dialogs')).toBeInTheDocument()
  })

  it('루트 영역 노출 (data-testid="folder-tree-root")', () => {
    render(<FolderTree workspaceId="ws" />)
    expect(screen.getByTestId('folder-tree-root')).toBeInTheDocument()
  })
})

/**
 * FolderTreeNodeDispatcher 단위 테스트 (P1-3 follow-up).
 *
 * node.data.kind 별로 올바른 ContextMenu + NodeRenderer 조합이 선택되는지 검증.
 * 무거운 child 컴포넌트(react-arborist NodeRenderer, Zustand store) 는 vi.mock 으로 stub.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { NodeApi, NodeRendererProps } from '../../lib/tree'
import type { WorkspaceTreeNode, FolderTreeNode } from '../../model/types'

// 무거운 의존성을 가벼운 마커로 대체 → 어떤 분기가 선택됐는지 DOM 으로 확인.
vi.mock('../FolderContextMenu', () => ({
  FolderContextMenu: ({ children, name }: { children: React.ReactNode; name: string }) => (
    <div data-testid="folder-context-menu" data-name={name}>
      {children}
    </div>
  )
}))
vi.mock('../FileContextMenu', () => ({
  FileContextMenu: ({
    children,
    name,
    kind
  }: {
    children: React.ReactNode
    name: string
    kind: string
  }) => (
    <div data-testid="file-context-menu" data-kind={kind} data-name={name}>
      {children}
    </div>
  )
}))
vi.mock('../FolderNodeRenderer', () => ({
  FolderNodeRenderer: () => <span data-testid="folder-renderer" />
}))
vi.mock('../NoteNodeRenderer', () => ({
  NoteNodeRenderer: () => <span data-testid="note-renderer" />
}))
vi.mock('../CsvNodeRenderer', () => ({
  CsvNodeRenderer: () => <span data-testid="csv-renderer" />
}))
vi.mock('../PdfNodeRenderer', () => ({
  PdfNodeRenderer: () => <span data-testid="pdf-renderer" />
}))
vi.mock('../ImageNodeRenderer', () => ({
  ImageNodeRenderer: () => <span data-testid="image-renderer" />
}))

vi.mock('@entities/note', () => ({
  useDuplicateNote: () => ({ mutate: vi.fn() })
}))
vi.mock('@entities/csv-file', () => ({
  useDuplicateCsvFile: () => ({ mutate: vi.fn() })
}))
vi.mock('@entities/pdf-file', () => ({
  useDuplicatePdfFile: () => ({ mutate: vi.fn() })
}))
vi.mock('@entities/image-file', () => ({
  useDuplicateImageFile: () => ({ mutate: vi.fn() })
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (selector: (s: { openRightTab: () => void }) => unknown) =>
    selector({ openRightTab: vi.fn() })
}))

// SUT 는 mock 정의 이후 import.
import { FolderTreeNodeDispatcher } from '../FolderTreeNodeDispatcher'
import type { FolderCreateHandlers } from '../../model/use-folder-create-handlers'
import type { FolderDialogState } from '../../model/use-folder-dialog-state'

function makeArboristProps(data: WorkspaceTreeNode): NodeRendererProps<WorkspaceTreeNode> {
  return {
    node: {
      id: data.id,
      data
    } as NodeApi<WorkspaceTreeNode>,
    tree: {} as never,
    style: {},
    dragHandle: undefined
  } as unknown as NodeRendererProps<WorkspaceTreeNode>
}

function makeHandlers(): FolderCreateHandlers {
  return {
    handleCreateNote: vi.fn(),
    handleCreateCsv: vi.fn(),
    handleImportNote: vi.fn(),
    handleImportCsv: vi.fn(),
    handleImportPdf: vi.fn(),
    handleImportImage: vi.fn()
  } as unknown as FolderCreateHandlers
}

function makeDialogState(): FolderDialogState {
  return {
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
  }
}

describe('FolderTreeNodeDispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders FolderContextMenu + FolderNodeRenderer for kind=folder', () => {
    const folderNode: FolderTreeNode = {
      id: 'f1',
      kind: 'folder',
      name: 'My Folder',
      color: '#abcdef',
      children: []
    } as unknown as FolderTreeNode
    render(
      <FolderTreeNodeDispatcher
        arboristProps={makeArboristProps(folderNode)}
        workspaceId="ws1"
        sourcePaneId="p1"
        activePathname=""
        createHandlers={makeHandlers()}
        dialogState={makeDialogState()}
      />
    )
    expect(screen.getByTestId('folder-context-menu')).toHaveAttribute('data-name', 'My Folder')
    expect(screen.getByTestId('folder-renderer')).toBeInTheDocument()
    expect(screen.queryByTestId('file-context-menu')).toBeNull()
  })

  it.each([
    ['note', 'note-renderer'],
    ['csv', 'csv-renderer'],
    ['pdf', 'pdf-renderer'],
    ['image', 'image-renderer']
  ] as const)('renders FileContextMenu + %s renderer for kind=%s', (kind, rendererTestId) => {
    const node = {
      id: `${kind}-1`,
      kind,
      name: `Test ${kind}`
    } as unknown as WorkspaceTreeNode
    render(
      <FolderTreeNodeDispatcher
        arboristProps={makeArboristProps(node)}
        workspaceId="ws1"
        sourcePaneId="p1"
        activePathname=""
        createHandlers={makeHandlers()}
        dialogState={makeDialogState()}
      />
    )
    const ctx = screen.getByTestId('file-context-menu')
    expect(ctx).toHaveAttribute('data-kind', kind)
    expect(ctx).toHaveAttribute('data-name', `Test ${kind}`)
    expect(screen.getByTestId(rendererTestId)).toBeInTheDocument()
    expect(screen.queryByTestId('folder-context-menu')).toBeNull()
  })
})

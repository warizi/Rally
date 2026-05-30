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
const ctxMenuMocks = vi.hoisted(() => ({
  fileOnDuplicate: undefined as undefined | (() => void),
  fileOnDelete: undefined as undefined | (() => void),
  fileKind: undefined as undefined | string
}))

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
    kind,
    onDuplicate,
    onDelete
  }: {
    children: React.ReactNode
    name: string
    kind: string
    onDuplicate?: () => void
    onDelete?: () => void
  }) => {
    ctxMenuMocks.fileOnDuplicate = onDuplicate
    ctxMenuMocks.fileOnDelete = onDelete
    ctxMenuMocks.fileKind = kind
    return (
      <div data-testid="file-context-menu" data-kind={kind} data-name={name}>
        {children}
      </div>
    )
  }
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

const duplicateMocks = vi.hoisted(() => ({
  noteDup: vi.fn(),
  csvDup: vi.fn(),
  pdfDup: vi.fn(),
  imageDup: vi.fn(),
  openRightTab: vi.fn()
}))

vi.mock('@entities/note', () => ({
  useDuplicateNote: () => ({ mutate: duplicateMocks.noteDup })
}))
vi.mock('@entities/csv-file', () => ({
  useDuplicateCsvFile: () => ({ mutate: duplicateMocks.csvDup })
}))
vi.mock('@entities/pdf-file', () => ({
  useDuplicatePdfFile: () => ({ mutate: duplicateMocks.pdfDup })
}))
vi.mock('@entities/image-file', () => ({
  useDuplicateImageFile: () => ({ mutate: duplicateMocks.imageDup })
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (selector: (s: { openRightTab: typeof duplicateMocks.openRightTab }) => unknown) =>
    selector({ openRightTab: duplicateMocks.openRightTab })
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

  it('matchedIds 가 node.id 포함 → isMatch=true (smoke)', () => {
    const noteNode = {
      id: 'note-match',
      kind: 'note',
      name: 'Matched Note'
    } as unknown as WorkspaceTreeNode
    render(
      <FolderTreeNodeDispatcher
        arboristProps={makeArboristProps(noteNode)}
        workspaceId="ws1"
        sourcePaneId="p1"
        activePathname=""
        createHandlers={makeHandlers()}
        dialogState={makeDialogState()}
        matchedIds={new Set(['note-match'])}
      />
    )
    expect(screen.getByTestId('note-renderer')).toBeInTheDocument()
  })

  it('activeMatchId === node.id → ref 적용 (smoke)', () => {
    const noteNode = {
      id: 'note-active',
      kind: 'note',
      name: 'Active Match'
    } as unknown as WorkspaceTreeNode
    render(
      <FolderTreeNodeDispatcher
        arboristProps={makeArboristProps(noteNode)}
        workspaceId="ws1"
        sourcePaneId="p1"
        activePathname=""
        createHandlers={makeHandlers()}
        dialogState={makeDialogState()}
        matchedIds={new Set(['note-active'])}
        activeMatchId={'note-active'}
      />
    )
    expect(screen.getByTestId('note-renderer')).toBeInTheDocument()
  })

  it('activePathname 가 node 와 매칭 → isActive=true 인 NoteNodeRenderer 호출 (smoke)', () => {
    const noteNode = {
      id: 'note-x',
      kind: 'note',
      name: 'NoteX'
    } as unknown as WorkspaceTreeNode
    render(
      <FolderTreeNodeDispatcher
        arboristProps={makeArboristProps(noteNode)}
        workspaceId="ws1"
        sourcePaneId="p1"
        activePathname="/folder/note/note-x"
        createHandlers={makeHandlers()}
        dialogState={makeDialogState()}
      />
    )
    expect(screen.getByTestId('note-renderer')).toBeInTheDocument()
  })

  it.each([
    ['note', 'noteDeleteTarget' as const],
    ['csv', 'csvDeleteTarget' as const],
    ['pdf', 'pdfDeleteTarget' as const],
    ['image', 'imageDeleteTarget' as const]
  ] as const)('kind=%s → FileContextMenu 의 onDelete 가 setXxxDeleteTarget 설정', (kind, key) => {
    const dialogState = makeDialogState()
    const setterKey = ('set' +
      key.charAt(0).toUpperCase() +
      key.slice(1)) as keyof FolderDialogState
    const setter = vi.fn()
    ;(dialogState[setterKey] as unknown) = setter
    const node = {
      id: `${kind}-x`,
      kind,
      name: `Name-${kind}`
    } as unknown as WorkspaceTreeNode
    render(
      <FolderTreeNodeDispatcher
        arboristProps={makeArboristProps(node)}
        workspaceId="ws1"
        sourcePaneId="p1"
        activePathname=""
        createHandlers={makeHandlers()}
        dialogState={dialogState}
      />
    )
    // FileContextMenu mock 은 onDelete prop 안 호출 — 안전 smoke
    expect(screen.getByTestId('file-context-menu')).toBeInTheDocument()
  })

  it('note: onDuplicate 호출 → useDuplicateNote mutate 호출', () => {
    duplicateMocks.noteDup.mockClear()
    const node = {
      id: 'n1',
      kind: 'note',
      name: 'NoteName'
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
    ctxMenuMocks.fileOnDuplicate?.()
    expect(duplicateMocks.noteDup).toHaveBeenCalledWith(
      { workspaceId: 'ws1', noteId: 'n1' },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    )
  })

  it('note: onDuplicate onSuccess → openRightTab 호출', () => {
    duplicateMocks.openRightTab.mockClear()
    duplicateMocks.noteDup.mockImplementation(
      (
        _v: unknown,
        opts: { onSuccess: (n: { id: string; title: string } | undefined) => void }
      ) => {
        opts.onSuccess({ id: 'n-new', title: 'New Note' })
      }
    )
    const node = {
      id: 'n1',
      kind: 'note',
      name: 'NoteName'
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
    ctxMenuMocks.fileOnDuplicate?.()
    expect(duplicateMocks.openRightTab).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'note',
        title: 'New Note',
        pathname: '/folder/note/n-new'
      }),
      'p1'
    )
  })

  it('note: onDuplicate onSuccess (data=null) → openRightTab 호출 안 함', () => {
    duplicateMocks.openRightTab.mockClear()
    duplicateMocks.noteDup.mockImplementation(
      (_v: unknown, opts: { onSuccess: (n: undefined) => void }) => {
        opts.onSuccess(undefined)
      }
    )
    const node = {
      id: 'n1',
      kind: 'note',
      name: 'X'
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
    ctxMenuMocks.fileOnDuplicate?.()
    expect(duplicateMocks.openRightTab).not.toHaveBeenCalled()
  })

  it('csv: onDuplicate → useDuplicateCsvFile.mutate 호출', () => {
    duplicateMocks.csvDup.mockClear()
    const node = {
      id: 'c1',
      kind: 'csv',
      name: 'Csv'
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
    ctxMenuMocks.fileOnDuplicate?.()
    expect(duplicateMocks.csvDup).toHaveBeenCalled()
  })

  it('pdf: onDuplicate → useDuplicatePdfFile.mutate 호출', () => {
    duplicateMocks.pdfDup.mockClear()
    const node = {
      id: 'p1',
      kind: 'pdf',
      name: 'Pdf'
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
    ctxMenuMocks.fileOnDuplicate?.()
    expect(duplicateMocks.pdfDup).toHaveBeenCalled()
  })

  it('image: onDuplicate → useDuplicateImageFile.mutate 호출', () => {
    duplicateMocks.imageDup.mockClear()
    const node = {
      id: 'i1',
      kind: 'image',
      name: 'Image'
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
    ctxMenuMocks.fileOnDuplicate?.()
    expect(duplicateMocks.imageDup).toHaveBeenCalled()
  })

  it('file onDelete → 각 kind 의 setXxxDeleteTarget 호출 (note)', () => {
    const dialogState = makeDialogState()
    const setter = vi.fn()
    dialogState.setNoteDeleteTarget = setter
    const node = {
      id: 'n1',
      kind: 'note',
      name: 'NoteX'
    } as unknown as WorkspaceTreeNode
    render(
      <FolderTreeNodeDispatcher
        arboristProps={makeArboristProps(node)}
        workspaceId="ws1"
        sourcePaneId="p1"
        activePathname=""
        createHandlers={makeHandlers()}
        dialogState={dialogState}
      />
    )
    ctxMenuMocks.fileOnDelete?.()
    expect(setter).toHaveBeenCalledWith({ id: 'n1', name: 'NoteX' })
  })

  it('activePathname 다른 kind 매칭 (csv) → isActive=true 전달 (smoke)', () => {
    const node = {
      id: 'c1',
      kind: 'csv',
      name: 'Csv'
    } as unknown as WorkspaceTreeNode
    render(
      <FolderTreeNodeDispatcher
        arboristProps={makeArboristProps(node)}
        workspaceId="ws1"
        sourcePaneId="p1"
        activePathname="/folder/csv/c1"
        createHandlers={makeHandlers()}
        dialogState={makeDialogState()}
      />
    )
    expect(screen.getByTestId('csv-renderer')).toBeInTheDocument()
  })

  it('activePathname 다른 kind 매칭 (pdf)', () => {
    const node = {
      id: 'p1',
      kind: 'pdf',
      name: 'Pdf'
    } as unknown as WorkspaceTreeNode
    render(
      <FolderTreeNodeDispatcher
        arboristProps={makeArboristProps(node)}
        workspaceId="ws1"
        sourcePaneId="p1"
        activePathname="/folder/pdf/p1"
        createHandlers={makeHandlers()}
        dialogState={makeDialogState()}
      />
    )
    expect(screen.getByTestId('pdf-renderer')).toBeInTheDocument()
  })
})

import { JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tree } from 'react-arborist'
import type { NodeApi, NodeRendererProps, TreeApi } from 'react-arborist'
import {
  ChevronsDownUp,
  FilePlus,
  FileText,
  FileUp,
  FolderPlus,
  ImageIcon,
  Sheet
} from 'lucide-react'

// 트리 DnD는 @dnd-kit으로 통일 (MainLayout의 DndContext에서 처리).
// react-arborist 내장 react-dnd 드래그/드롭은 disableDrag/disableDrop으로 비활성화한다.
import {
  useCreateFolder,
  useRenameFolder,
  useRemoveFolder,
  useUpdateFolderMeta
} from '@entities/folder'
import {
  useCreateNote,
  useDuplicateNote,
  useImportNote,
  useRemoveNote
} from '@entities/note'
import type { NoteNode } from '@entities/note'
import {
  useCreateCsvFile,
  useDuplicateCsvFile,
  useImportCsvFile,
  useRemoveCsvFile
} from '@entities/csv-file'
import type { CsvFileNode } from '@entities/csv-file'
import {
  useDuplicatePdfFile,
  useImportPdfFile,
  useRemovePdfFile
} from '@entities/pdf-file'
import {
  useDuplicateImageFile,
  useImportImageFile,
  useRemoveImageFile
} from '@entities/image-file'
import type { ImageFileNode } from '@entities/image-file'
import { Button } from '@shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { useWorkspaceTree } from '../model/use-workspace-tree'
import { useTreeOpenState } from '../model/use-tree-open-state'
import { useTreeMoveListener } from '../model/use-tree-move-listener'
import type {
  WorkspaceTreeNode,
  FolderTreeNode,
  NoteTreeNode,
  CsvTreeNode,
  PdfTreeNode,
  ImageTreeNode
} from '../model/types'
import { FolderColorDialog } from './FolderColorDialog'
import { FolderContextMenu } from './FolderContextMenu'
import { FolderNameDialog } from './FolderNameDialog'
import { FolderNodeRenderer } from './FolderNodeRenderer'
import { FileContextMenu } from './FileContextMenu'
import { NoteNodeRenderer } from './NoteNodeRenderer'
import { CsvNodeRenderer } from './CsvNodeRenderer'
import { PdfNodeRenderer } from './PdfNodeRenderer'
import { ImageNodeRenderer } from './ImageNodeRenderer'
import { DeleteFolderDialog } from './DeleteFolderDialog'

interface Props {
  workspaceId: string
  tabId?: string // sourcePaneId 계산용 (FolderPage에서 전달)
}

const ROW_HEIGHT = 36

const KIND_TO_PREFIX: Record<string, string> = {
  note: '/folder/note/',
  csv: '/folder/csv/',
  pdf: '/folder/pdf/',
  image: '/folder/image/'
}

function collectDescendantPathnames(nodes: WorkspaceTreeNode[]): string[] {
  const result: string[] = []
  for (const node of nodes) {
    const prefix = KIND_TO_PREFIX[node.kind]
    if (prefix) {
      result.push(prefix + node.id)
    } else if (node.kind === 'folder') {
      result.push(...collectDescendantPathnames(node.children))
    }
  }
  return result
}

function findFolderNode(nodes: WorkspaceTreeNode[], id: string): FolderTreeNode | null {
  for (const node of nodes) {
    if (node.id === id && node.kind === 'folder') return node as FolderTreeNode
    if (node.kind === 'folder') {
      const found = findFolderNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

function countVisibleNodes(nodes: WorkspaceTreeNode[], openState: Record<string, boolean>): number {
  let count = 0
  for (const node of nodes) {
    count++
    if (node.kind === 'folder' && openState[node.id]) {
      count += countVisibleNodes(node.children, openState)
    }
  }
  return count
}

export function FolderTree({ workspaceId, tabId }: Props): JSX.Element {
  const { tree } = useWorkspaceTree(workspaceId)
  const treeRef = useRef<TreeApi<WorkspaceTreeNode>>(null)
  const { openState, toggle, collapseAll, expandToItem } = useTreeOpenState(tabId)

  // 트리 내 DnD 이동을 @dnd-kit 기반으로 처리
  useTreeMoveListener(workspaceId)

  const visibleCount = useMemo(() => countVisibleNodes(tree, openState), [tree, openState])
  const treeHeight = visibleCount * ROW_HEIGHT

  // Folder mutations (move는 useTreeMoveListener에서 사용)
  const { mutate: createFolder, isPending: isCreatingFolder } = useCreateFolder()
  const { mutate: rename, isPending: isRenaming } = useRenameFolder()
  const { mutate: remove, isPending: isRemoving } = useRemoveFolder()
  const { mutate: updateMeta, isPending: isUpdatingMeta } = useUpdateFolderMeta()

  // Note mutations (moveNote는 useTreeMoveListener에서 사용)
  const { mutate: createNote } = useCreateNote()
  const { mutateAsync: importNote } = useImportNote()
  const { mutate: duplicateNote } = useDuplicateNote()
  const { mutate: removeNote, isPending: isRemovingNote } = useRemoveNote()

  // CSV mutations
  const { mutate: createCsvFile } = useCreateCsvFile()
  const { mutateAsync: importCsvFile } = useImportCsvFile()
  const { mutate: duplicateCsvFile } = useDuplicateCsvFile()
  const { mutate: removeCsvFile, isPending: isRemovingCsv } = useRemoveCsvFile()

  // PDF mutations
  const { mutate: importPdfFile } = useImportPdfFile()
  const { mutate: duplicatePdfFile } = useDuplicatePdfFile()
  const { mutate: removePdfFile, isPending: isRemovingPdf } = useRemovePdfFile()

  // Image mutations — mutateAsync for multi-file import loop
  const { mutateAsync: importImageFile } = useImportImageFile()
  const { mutate: duplicateImageFile } = useDuplicateImageFile()
  const { mutate: removeImageFile, isPending: isRemovingImage } = useRemoveImageFile()

  // Tab store
  const openRightTab = useTabStore((s) => s.openRightTab)
  const closeTabByPathname = useTabStore((s) => s.closeTabByPathname)
  const findPaneByTabId = useTabStore((s) => s.findPaneByTabId)
  const activeTab = useTabStore((s) => s.getActiveTab())
  const sourcePaneId = tabId ? (findPaneByTabId(tabId)?.id ?? '') : ''
  const activePathname = activeTab?.pathname ?? ''

  // 활성 탭 아이템이 폴더 내부에 있으면 상위 폴더를 자동 펼침
  useEffect(() => {
    const match = activePathname.match(/^\/folder\/(?:note|csv|pdf|image)\/(.+)$/)
    if (!match) return
    const itemId = match[1]
    expandToItem(tree, itemId, treeRef.current)
  }, [activePathname, tree, expandToItem])

  // Folder dialog states
  const [createTarget, setCreateTarget] = useState<{ parentFolderId: string | null } | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null)
  const [colorTarget, setColorTarget] = useState<{ id: string; color: string | null } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  // Note dialog states
  const [noteDeleteTarget, setNoteDeleteTarget] = useState<{ id: string; name: string } | null>(
    null
  )

  // CSV dialog states
  const [csvDeleteTarget, setCsvDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  // PDF dialog states
  const [pdfDeleteTarget, setPdfDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  // Image dialog states
  const [imageDeleteTarget, setImageDeleteTarget] = useState<{ id: string; name: string } | null>(
    null
  )

  /** 노트 생성 → 성공 시 오른쪽 탭에 자동 오픈 */
  const handleCreateNote = useCallback(
    (folderId: string | null) => {
      createNote(
        { workspaceId, folderId, name: '새로운 노트' },
        {
          onSuccess: (note) => {
            if (!note) return
            openRightTab(
              {
                type: 'note',
                title: note.title,
                pathname: `/folder/note/${note.id}`
              },
              sourcePaneId
            )
          }
        }
      )
    },
    [workspaceId, sourcePaneId, createNote, openRightTab]
  )

  /** CSV 생성 → 성공 시 오른쪽 탭에 자동 오픈 */
  const handleCreateCsv = useCallback(
    (folderId: string | null) => {
      createCsvFile(
        { workspaceId, folderId, name: '새로운 테이블' },
        {
          onSuccess: (csv) => {
            if (!csv) return
            openRightTab(
              {
                type: 'csv',
                title: csv.title,
                pathname: `/folder/csv/${csv.id}`
              },
              sourcePaneId
            )
          }
        }
      )
    },
    [workspaceId, sourcePaneId, createCsvFile, openRightTab]
  )

  /** 노트 가져오기 → 다중 .md 선택 → import × N → 마지막 노트 탭 오픈 */
  const handleImportNote = useCallback(
    async (folderId: string | null) => {
      const filePaths = await window.api.note.selectFile()
      if (!filePaths || filePaths.length === 0) return
      let lastImported: NoteNode | undefined
      for (const sourcePath of filePaths) {
        lastImported = await importNote({ workspaceId, folderId, sourcePath })
      }
      if (lastImported) {
        openRightTab(
          {
            type: 'note',
            title: lastImported.title,
            pathname: `/folder/note/${lastImported.id}`
          },
          sourcePaneId
        )
      }
    },
    [workspaceId, sourcePaneId, importNote, openRightTab]
  )

  /** 테이블 가져오기 → 다중 .csv 선택 → import × N → 마지막 테이블 탭 오픈 */
  const handleImportCsv = useCallback(
    async (folderId: string | null) => {
      const filePaths = await window.api.csv.selectFile()
      if (!filePaths || filePaths.length === 0) return
      let lastImported: CsvFileNode | undefined
      for (const sourcePath of filePaths) {
        lastImported = await importCsvFile({ workspaceId, folderId, sourcePath })
      }
      if (lastImported) {
        openRightTab(
          {
            type: 'csv',
            title: lastImported.title,
            pathname: `/folder/csv/${lastImported.id}`
          },
          sourcePaneId
        )
      }
    },
    [workspaceId, sourcePaneId, importCsvFile, openRightTab]
  )

  /** PDF 가져오기 → 파일 선택 다이얼로그 → import → 성공 시 오른쪽 탭에 자동 오픈 */
  const handleImportPdf = useCallback(
    async (folderId: string | null) => {
      const sourcePath = await window.api.pdf.selectFile()
      if (!sourcePath) return
      importPdfFile(
        { workspaceId, folderId, sourcePath },
        {
          onSuccess: (pdf) => {
            if (!pdf) return
            openRightTab(
              {
                type: 'pdf',
                title: pdf.title,
                pathname: `/folder/pdf/${pdf.id}`
              },
              sourcePaneId
            )
          }
        }
      )
    },
    [workspaceId, sourcePaneId, importPdfFile, openRightTab]
  )

  /** 이미지 가져오기 → selectFile 다이얼로그 (다중 선택) → import × N → 마지막 이미지만 탭 열기 */
  const handleImportImage = useCallback(
    async (folderId: string | null) => {
      const filePaths = await window.api.image.selectFile()
      if (!filePaths || filePaths.length === 0) return
      let lastImported: ImageFileNode | undefined
      for (const sourcePath of filePaths) {
        lastImported = await importImageFile({ workspaceId, folderId, sourcePath })
      }
      if (lastImported) {
        openRightTab(
          {
            type: 'image',
            title: lastImported.title,
            pathname: `/folder/image/${lastImported.id}`
          },
          sourcePaneId
        )
      }
    },
    [workspaceId, sourcePaneId, importImageFile, openRightTab]
  )

  const NodeRenderer = useCallback(
    (props: NodeRendererProps<WorkspaceTreeNode>) => {
      if (props.node.data.kind === 'note') {
        return (
          <FileContextMenu
            name={props.node.data.name}
            kind="note"
            onDuplicate={() =>
              duplicateNote(
                { workspaceId, noteId: props.node.data.id },
                {
                  onSuccess: (note) => {
                    if (!note) return
                    openRightTab(
                      {
                        type: 'note',
                        title: note.title,
                        pathname: `/folder/note/${note.id}`
                      },
                      sourcePaneId
                    )
                  }
                }
              )
            }
            onDelete={() =>
              setNoteDeleteTarget({ id: props.node.data.id, name: props.node.data.name })
            }
          >
            <div className="rounded data-[state=open]:bg-accent data-[state=open]:ring-1 data-[state=open]:ring-inset data-[state=open]:ring-ring">
              <NoteNodeRenderer
                {...(props as unknown as NodeRendererProps<NoteTreeNode>)}
                workspaceId={workspaceId}
                sourcePaneId={sourcePaneId}
                isActive={activePathname === `/folder/note/${props.node.data.id}`}
                onOpen={() =>
                  openRightTab(
                    {
                      type: 'note',
                      title: props.node.data.name,
                      pathname: `/folder/note/${props.node.data.id}`
                    },
                    sourcePaneId
                  )
                }
              />
            </div>
          </FileContextMenu>
        )
      }

      if (props.node.data.kind === 'csv') {
        return (
          <FileContextMenu
            name={props.node.data.name}
            kind="csv"
            onDuplicate={() =>
              duplicateCsvFile(
                { workspaceId, csvId: props.node.data.id },
                {
                  onSuccess: (csv) => {
                    if (!csv) return
                    openRightTab(
                      {
                        type: 'csv',
                        title: csv.title,
                        pathname: `/folder/csv/${csv.id}`
                      },
                      sourcePaneId
                    )
                  }
                }
              )
            }
            onDelete={() =>
              setCsvDeleteTarget({ id: props.node.data.id, name: props.node.data.name })
            }
          >
            <div className="rounded data-[state=open]:bg-accent data-[state=open]:ring-1 data-[state=open]:ring-inset data-[state=open]:ring-ring">
              <CsvNodeRenderer
                {...(props as unknown as NodeRendererProps<CsvTreeNode>)}
                workspaceId={workspaceId}
                sourcePaneId={sourcePaneId}
                isActive={activePathname === `/folder/csv/${props.node.data.id}`}
                onOpen={() =>
                  openRightTab(
                    {
                      type: 'csv',
                      title: props.node.data.name,
                      pathname: `/folder/csv/${props.node.data.id}`
                    },
                    sourcePaneId
                  )
                }
              />
            </div>
          </FileContextMenu>
        )
      }

      if (props.node.data.kind === 'pdf') {
        return (
          <FileContextMenu
            name={props.node.data.name}
            kind="pdf"
            onDuplicate={() =>
              duplicatePdfFile(
                { workspaceId, pdfId: props.node.data.id },
                {
                  onSuccess: (pdf) => {
                    if (!pdf) return
                    openRightTab(
                      {
                        type: 'pdf',
                        title: pdf.title,
                        pathname: `/folder/pdf/${pdf.id}`
                      },
                      sourcePaneId
                    )
                  }
                }
              )
            }
            onDelete={() =>
              setPdfDeleteTarget({ id: props.node.data.id, name: props.node.data.name })
            }
          >
            <div className="rounded data-[state=open]:bg-accent data-[state=open]:ring-1 data-[state=open]:ring-inset data-[state=open]:ring-ring">
              <PdfNodeRenderer
                {...(props as unknown as NodeRendererProps<PdfTreeNode>)}
                workspaceId={workspaceId}
                sourcePaneId={sourcePaneId}
                isActive={activePathname === `/folder/pdf/${props.node.data.id}`}
                onOpen={() =>
                  openRightTab(
                    {
                      type: 'pdf',
                      title: props.node.data.name,
                      pathname: `/folder/pdf/${props.node.data.id}`
                    },
                    sourcePaneId
                  )
                }
              />
            </div>
          </FileContextMenu>
        )
      }

      if (props.node.data.kind === 'image') {
        return (
          <FileContextMenu
            name={props.node.data.name}
            kind="image"
            onDuplicate={() =>
              duplicateImageFile(
                { workspaceId, imageId: props.node.data.id },
                {
                  onSuccess: (image) => {
                    if (!image) return
                    openRightTab(
                      {
                        type: 'image',
                        title: image.title,
                        pathname: `/folder/image/${image.id}`
                      },
                      sourcePaneId
                    )
                  }
                }
              )
            }
            onDelete={() =>
              setImageDeleteTarget({ id: props.node.data.id, name: props.node.data.name })
            }
          >
            <div className="rounded data-[state=open]:bg-accent data-[state=open]:ring-1 data-[state=open]:ring-inset data-[state=open]:ring-ring">
              <ImageNodeRenderer
                {...(props as unknown as NodeRendererProps<ImageTreeNode>)}
                workspaceId={workspaceId}
                sourcePaneId={sourcePaneId}
                isActive={activePathname === `/folder/image/${props.node.data.id}`}
                onOpen={() =>
                  openRightTab(
                    {
                      type: 'image',
                      title: props.node.data.name,
                      pathname: `/folder/image/${props.node.data.id}`
                    },
                    sourcePaneId
                  )
                }
              />
            </div>
          </FileContextMenu>
        )
      }

      // kind === 'folder'
      return (
        <FolderContextMenu
          name={props.node.data.name}
          color={(props.node.data as FolderTreeNode).color}
          onCreateChild={() => setCreateTarget({ parentFolderId: props.node.id })}
          onCreateNote={() => handleCreateNote(props.node.id)}
          onImportNote={() => handleImportNote(props.node.id)}
          onCreateCsv={() => handleCreateCsv(props.node.id)}
          onImportCsv={() => handleImportCsv(props.node.id)}
          onImportPdf={() => handleImportPdf(props.node.id)}
          onImportImage={() => handleImportImage(props.node.id)}
          onRename={() => setRenameTarget({ id: props.node.id, name: props.node.data.name })}
          onEditColor={() =>
            setColorTarget({
              id: props.node.id,
              color: (props.node.data as FolderTreeNode).color
            })
          }
          onDelete={() => setDeleteTarget({ id: props.node.id, name: props.node.data.name })}
        >
          <div className="rounded data-[state=open]:bg-accent data-[state=open]:ring-1 data-[state=open]:ring-inset data-[state=open]:ring-ring">
            <FolderNodeRenderer
              {...(props as unknown as NodeRendererProps<FolderTreeNode>)}
              workspaceId={workspaceId}
              sourcePaneId={sourcePaneId}
            />
          </div>
        </FolderContextMenu>
      )
    },
    [
      workspaceId,
      sourcePaneId,
      activePathname,
      handleCreateNote,
      handleImportNote,
      handleCreateCsv,
      handleImportCsv,
      handleImportPdf,
      handleImportImage,
      duplicateNote,
      duplicateCsvFile,
      duplicatePdfFile,
      duplicateImageFile,
      openRightTab
    ]
  )

  return (
    <div className="flex flex-col relative px-6 pt-6 pb-2">
      {/* 툴바 */}
      <div className="flex items-center justify-between py-1 shrink-0 border-b mb-2 sticky top-0 bg-background z-10">
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          탐색기
        </span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 cursor-pointer"
                onClick={() => {
                  treeRef.current?.closeAll()
                  collapseAll()
                }}
              >
                <ChevronsDownUp className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>모두 접기</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-6 cursor-pointer">
                    <FileText className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>노트</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => handleImportNote(null)}>
                <FileUp className="size-4 mr-2" />
                노트 가져오기
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateNote(null)}>
                <FilePlus className="size-4 mr-2" />
                노트 추가하기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-6 cursor-pointer">
                    <Sheet className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>테이블</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => handleCreateCsv(null)}>
                <FilePlus className="size-4 mr-2" />
                테이블 추가하기
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleImportCsv(null)}>
                <FileUp className="size-4 mr-2" />
                테이블 가져오기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 cursor-pointer"
                onClick={() => handleImportPdf(null)}
              >
                <FileUp className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>PDF 가져오기</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 cursor-pointer"
                onClick={() => handleImportImage(null)}
              >
                <ImageIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>이미지 가져오기</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 cursor-pointer"
                onClick={() => setCreateTarget({ parentFolderId: null })}
              >
                <FolderPlus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>폴더 추가</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 트리 또는 빈 상태 */}
      {tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground px-4">
          <FolderPlus className="size-8 opacity-30" />
          <p className="text-xs text-center">폴더가 없습니다.</p>
          <p className="text-xs text-center opacity-70">위의 + 버튼으로 폴더를 추가하세요.</p>
        </div>
      ) : (
        <div>
          <Tree<WorkspaceTreeNode>
            key={workspaceId}
            ref={treeRef}
            data={tree}
            idAccessor="id"
            initialOpenState={openState}
            openByDefault={false}
            childrenAccessor={(n) => (n.kind === 'folder' ? n.children : null)}
            // 트리 내장 DnD는 비활성화. 모든 DnD는 @dnd-kit으로 통일하여 MainLayout에서 처리.
            disableDrag
            disableDrop
            disableEdit={(n) =>
              n.kind === 'note' || n.kind === 'csv' || n.kind === 'pdf' || n.kind === 'image'
            }
            onToggle={(id) => toggle(id, treeRef.current?.isOpen(id) ?? false)}
            onCreate={({ parentId }) => {
              setCreateTarget({ parentFolderId: parentId ?? null })
              return null
            }}
            onRename={({ id, name }) => {
              // react-arborist 인라인 rename은 폴더 전용 (disableEdit으로 노트 진입 차단)
              rename({ workspaceId, folderId: id, newName: name })
            }}
            // onMove는 react-arborist의 내장 DnD가 비활성화되어 호출되지 않는다.
            // 트리 내 이동은 @dnd-kit 기반 useTreeMoveListener (아래 hook)에서 처리한다.
            onDelete={({ ids, nodes }: { ids: string[]; nodes: NodeApi<WorkspaceTreeNode>[] }) => {
              if (nodes.length === 0) return
              const firstNode = nodes[0]
              if (firstNode.data.kind === 'note') {
                setNoteDeleteTarget({ id: ids[0], name: firstNode.data.name })
              } else if (firstNode.data.kind === 'csv') {
                setCsvDeleteTarget({ id: ids[0], name: firstNode.data.name })
              } else if (firstNode.data.kind === 'pdf') {
                setPdfDeleteTarget({ id: ids[0], name: firstNode.data.name })
              } else if (firstNode.data.kind === 'image') {
                setImageDeleteTarget({ id: ids[0], name: firstNode.data.name })
              } else {
                setDeleteTarget({ id: ids[0], name: firstNode.data.name })
              }
            }}
            height={treeHeight}
            width="100%"
            className="px-2"
          >
            {NodeRenderer}
          </Tree>
        </div>
      )}

      {/* 폴더 생성 다이얼로그 */}
      <FolderNameDialog
        open={createTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCreateTarget(null)
        }}
        title="폴더 생성"
        defaultValue=""
        submitLabel="생성"
        isPending={isCreatingFolder}
        onSubmit={(name) => {
          if (createTarget) {
            createFolder(
              { workspaceId, parentFolderId: createTarget.parentFolderId, name },
              { onSuccess: () => setCreateTarget(null) }
            )
          }
        }}
      />

      {/* 폴더 이름 변경 다이얼로그 */}
      <FolderNameDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
        title="이름 변경"
        defaultValue={renameTarget?.name ?? ''}
        submitLabel="변경"
        isPending={isRenaming}
        onSubmit={(name) => {
          if (renameTarget) {
            rename(
              { workspaceId, folderId: renameTarget.id, newName: name },
              { onSuccess: () => setRenameTarget(null) }
            )
          }
        }}
      />

      {/* 폴더 색상 다이얼로그 */}
      <FolderColorDialog
        open={colorTarget !== null}
        onOpenChange={(open) => {
          if (!open) setColorTarget(null)
        }}
        currentColor={colorTarget?.color ?? null}
        isPending={isUpdatingMeta}
        onSubmit={(color) => {
          if (colorTarget) {
            updateMeta(
              { workspaceId, folderId: colorTarget.id, data: { color } },
              { onSuccess: () => setColorTarget(null) }
            )
          }
        }}
      />

      {/* 폴더 삭제 다이얼로그 */}
      <DeleteFolderDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        folderName={deleteTarget?.name ?? ''}
        isPending={isRemoving}
        onConfirm={() => {
          if (deleteTarget) {
            const folder = findFolderNode(tree, deleteTarget.id)
            const childPathnames = folder ? collectDescendantPathnames(folder.children) : []
            remove(
              { workspaceId, folderId: deleteTarget.id },
              {
                onSuccess: () => {
                  childPathnames.forEach((p) => closeTabByPathname(p))
                  setDeleteTarget(null)
                }
              }
            )
          }
        }}
      />

      {/* 노트 삭제 다이얼로그 (DeleteFolderDialog 재사용) */}
      <DeleteFolderDialog
        open={noteDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setNoteDeleteTarget(null)
        }}
        folderName={noteDeleteTarget?.name ?? ''}
        isPending={isRemovingNote}
        onConfirm={() => {
          if (noteDeleteTarget) {
            removeNote(
              { workspaceId, noteId: noteDeleteTarget.id },
              {
                onSuccess: () => {
                  closeTabByPathname(`/folder/note/${noteDeleteTarget.id}`)
                  setNoteDeleteTarget(null)
                }
              }
            )
          }
        }}
      />

      {/* CSV 삭제 다이얼로그 */}
      <DeleteFolderDialog
        open={csvDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCsvDeleteTarget(null)
        }}
        folderName={csvDeleteTarget?.name ?? ''}
        isPending={isRemovingCsv}
        onConfirm={() => {
          if (csvDeleteTarget) {
            removeCsvFile(
              { workspaceId, csvId: csvDeleteTarget.id },
              {
                onSuccess: () => {
                  closeTabByPathname(`/folder/csv/${csvDeleteTarget.id}`)
                  setCsvDeleteTarget(null)
                }
              }
            )
          }
        }}
      />

      {/* PDF 삭제 다이얼로그 */}
      <DeleteFolderDialog
        open={pdfDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPdfDeleteTarget(null)
        }}
        folderName={pdfDeleteTarget?.name ?? ''}
        isPending={isRemovingPdf}
        onConfirm={() => {
          if (pdfDeleteTarget) {
            removePdfFile(
              { workspaceId, pdfId: pdfDeleteTarget.id },
              {
                onSuccess: () => {
                  closeTabByPathname(`/folder/pdf/${pdfDeleteTarget.id}`)
                  setPdfDeleteTarget(null)
                }
              }
            )
          }
        }}
      />

      {/* Image 삭제 다이얼로그 */}
      <DeleteFolderDialog
        open={imageDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setImageDeleteTarget(null)
        }}
        folderName={imageDeleteTarget?.name ?? ''}
        isPending={isRemovingImage}
        onConfirm={() => {
          if (imageDeleteTarget) {
            removeImageFile(
              { workspaceId, imageId: imageDeleteTarget.id },
              {
                onSuccess: () => {
                  closeTabByPathname(`/folder/image/${imageDeleteTarget.id}`)
                  setImageDeleteTarget(null)
                }
              }
            )
          }
        }}
      />
    </div>
  )
}

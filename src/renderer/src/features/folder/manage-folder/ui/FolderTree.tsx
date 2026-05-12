import { JSX, useCallback, useEffect, useMemo, useRef } from 'react'
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
import { Button } from '@shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent
} from '@shared/ui/empty'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { useWorkspaceTree } from '../model/use-workspace-tree'
import { useTreeOpenState } from '../model/use-tree-open-state'
import { useTreeMoveListener } from '../model/use-tree-move-listener'
import { useFolderDialogState } from '../model/use-folder-dialog-state'
import { useFolderCreateHandlers } from '../model/use-folder-create-handlers'
import { useFolderMutations } from '../model/use-folder-mutations'
import {
  collectDescendantPathnames,
  findFolderNode,
  countVisibleNodes
} from '../model/folder-tree-helpers'
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

export function FolderTree({ workspaceId, tabId }: Props): JSX.Element {
  const { tree } = useWorkspaceTree(workspaceId)
  const treeRef = useRef<TreeApi<WorkspaceTreeNode>>(null)
  const { openState, toggle, collapseAll, expandToItem } = useTreeOpenState(tabId)

  // 트리 내 DnD 이동을 @dnd-kit 기반으로 처리
  useTreeMoveListener(workspaceId)

  const visibleCount = useMemo(() => countVisibleNodes(tree, openState), [tree, openState])
  const treeHeight = visibleCount * ROW_HEIGHT

  // 8 mutation hooks (folder 4 + note/csv/pdf/image duplicate+remove)
  // → use-folder-mutations 훅으로 묶음. flat destructure 로 호출 측 변경 0.
  const {
    createFolder,
    isCreatingFolder,
    rename,
    isRenaming,
    remove,
    isRemoving,
    updateMeta,
    isUpdatingMeta,
    duplicateNote,
    removeNote,
    isRemovingNote,
    duplicateCsvFile,
    removeCsvFile,
    isRemovingCsv,
    duplicatePdfFile,
    removePdfFile,
    isRemovingPdf,
    duplicateImageFile,
    removeImageFile,
    isRemovingImage
  } = useFolderMutations()

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

  // Dialog states (8개 useState → use-folder-dialog-state 훅으로 묶음)
  const {
    createTarget,
    setCreateTarget,
    renameTarget,
    setRenameTarget,
    colorTarget,
    setColorTarget,
    deleteTarget,
    setDeleteTarget,
    noteDeleteTarget,
    setNoteDeleteTarget,
    csvDeleteTarget,
    setCsvDeleteTarget,
    pdfDeleteTarget,
    setPdfDeleteTarget,
    imageDeleteTarget,
    setImageDeleteTarget
  } = useFolderDialogState()

  // 6개 create/import 핸들러 (use-folder-create-handlers 훅으로 묶음)
  const {
    handleCreateNote,
    handleCreateCsv,
    handleImportNote,
    handleImportCsv,
    handleImportPdf,
    handleImportImage
  } = useFolderCreateHandlers({ workspaceId, sourcePaneId })

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
    <div data-testid="folder-tree-root" className="flex flex-col relative px-6 pt-6 pb-2">
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
        <Empty className="border border-dashed mt-2">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderPlus className="size-5" />
            </EmptyMedia>
            <EmptyTitle className="text-sm">첫 노트를 만들어보세요</EmptyTitle>
            <EmptyDescription className="text-xs">노트, 표, 폴더로 시작하세요.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => handleCreateNote(null)}>
                <FilePlus className="size-3" /> 노트
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleCreateCsv(null)}>
                <Sheet className="size-3" /> 표
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreateTarget({ parentFolderId: null })}
              >
                <FolderPlus className="size-3" /> 폴더
              </Button>
            </div>
          </EmptyContent>
        </Empty>
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

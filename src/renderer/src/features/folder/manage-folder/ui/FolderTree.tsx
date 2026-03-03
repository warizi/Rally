import { JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tree } from 'react-arborist'
import type { NodeApi, NodeRendererProps, TreeApi } from 'react-arborist'
import { createDragDropManager } from 'dnd-core'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { ChevronsDownUp, FilePlus, FolderPlus } from 'lucide-react'

// 여러 Tree 인스턴스(여러 폴더 탭)가 동시에 마운트될 때
// "Cannot have two HTML5 backends" 에러 방지를 위해 공유 DnD 매니저 사용
const sharedDndManager = createDragDropManager(HTML5Backend)
import {
  useCreateFolder,
  useRenameFolder,
  useRemoveFolder,
  useMoveFolder,
  useUpdateFolderMeta
} from '@entities/folder'
import { useCreateNote, useMoveNote, useRemoveNote } from '@entities/note'
import { useCreateCsvFile, useMoveCsvFile, useRemoveCsvFile } from '@entities/csv-file'
import { useImportPdfFile, useMovePdfFile, useRemovePdfFile } from '@entities/pdf-file'
import { useImportImageFile, useMoveImageFile, useRemoveImageFile } from '@entities/image-file'
import type { ImageFileNode } from '@entities/image-file'
import { Button } from '@shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { useWorkspaceTree } from '../model/use-workspace-tree'
import { useTreeOpenState } from '../model/use-tree-open-state'
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
import { NoteContextMenu } from './NoteContextMenu'
import { NoteNodeRenderer } from './NoteNodeRenderer'
import { CsvContextMenu } from './CsvContextMenu'
import { CsvNodeRenderer } from './CsvNodeRenderer'
import { PdfContextMenu } from './PdfContextMenu'
import { PdfNodeRenderer } from './PdfNodeRenderer'
import { ImageContextMenu } from './ImageContextMenu'
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

function countVisibleNodes(
  nodes: WorkspaceTreeNode[],
  openState: Record<string, boolean>
): number {
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

  const visibleCount = useMemo(() => countVisibleNodes(tree, openState), [tree, openState])
  const treeHeight = visibleCount * ROW_HEIGHT

  // Folder mutations
  const { mutate: createFolder, isPending: isCreatingFolder } = useCreateFolder()
  const { mutate: rename, isPending: isRenaming } = useRenameFolder()
  const { mutate: remove, isPending: isRemoving } = useRemoveFolder()
  const { mutate: move } = useMoveFolder()
  const { mutate: updateMeta, isPending: isUpdatingMeta } = useUpdateFolderMeta()

  // Note mutations
  const { mutate: createNote } = useCreateNote()
  const { mutate: moveNote } = useMoveNote()
  const { mutate: removeNote, isPending: isRemovingNote } = useRemoveNote()

  // CSV mutations
  const { mutate: createCsvFile } = useCreateCsvFile()
  const { mutate: moveCsvFile } = useMoveCsvFile()
  const { mutate: removeCsvFile, isPending: isRemovingCsv } = useRemoveCsvFile()

  // PDF mutations
  const { mutate: importPdfFile } = useImportPdfFile()
  const { mutate: movePdfFile } = useMovePdfFile()
  const { mutate: removePdfFile, isPending: isRemovingPdf } = useRemovePdfFile()

  // Image mutations — mutateAsync for multi-file import loop
  const { mutateAsync: importImageFile } = useImportImageFile()
  const { mutate: moveImageFile } = useMoveImageFile()
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
          <NoteContextMenu
            onDelete={() =>
              setNoteDeleteTarget({ id: props.node.data.id, name: props.node.data.name })
            }
          >
            <div>
              <NoteNodeRenderer
                {...(props as unknown as NodeRendererProps<NoteTreeNode>)}
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
          </NoteContextMenu>
        )
      }

      if (props.node.data.kind === 'csv') {
        return (
          <CsvContextMenu
            onDelete={() =>
              setCsvDeleteTarget({ id: props.node.data.id, name: props.node.data.name })
            }
          >
            <div>
              <CsvNodeRenderer
                {...(props as unknown as NodeRendererProps<CsvTreeNode>)}
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
          </CsvContextMenu>
        )
      }

      if (props.node.data.kind === 'pdf') {
        return (
          <PdfContextMenu
            onDelete={() =>
              setPdfDeleteTarget({ id: props.node.data.id, name: props.node.data.name })
            }
          >
            <div>
              <PdfNodeRenderer
                {...(props as unknown as NodeRendererProps<PdfTreeNode>)}
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
          </PdfContextMenu>
        )
      }

      if (props.node.data.kind === 'image') {
        return (
          <ImageContextMenu
            onDelete={() =>
              setImageDeleteTarget({ id: props.node.data.id, name: props.node.data.name })
            }
          >
            <div>
              <ImageNodeRenderer
                {...(props as unknown as NodeRendererProps<ImageTreeNode>)}
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
          </ImageContextMenu>
        )
      }

      // kind === 'folder'
      return (
        <FolderContextMenu
          onCreateChild={() => setCreateTarget({ parentFolderId: props.node.id })}
          onCreateNote={() => handleCreateNote(props.node.id)}
          onCreateCsv={() => handleCreateCsv(props.node.id)}
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
          <div>
            <FolderNodeRenderer {...(props as unknown as NodeRendererProps<FolderTreeNode>)} />
          </div>
        </FolderContextMenu>
      )
    },
    // workspaceId는 NodeRenderer 내부에서 직접 참조하지 않음
    // (handleCreateNote가 이미 workspaceId를 capture하고 있어 deps에서 제외)
    [
      sourcePaneId,
      activePathname,
      handleCreateNote,
      handleCreateCsv,
      handleImportPdf,
      handleImportImage,
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 cursor-pointer"
                onClick={() => handleCreateNote(null)}
              >
                <FilePlus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>노트 추가</TooltipContent>
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
            dndManager={sharedDndManager}
            data={tree}
            idAccessor="id"
            initialOpenState={openState}
            openByDefault={false}
            childrenAccessor={(n) => (n.kind === 'folder' ? n.children : null)}
            disableDrop={({ parentNode }) =>
              parentNode?.data.kind === 'note' ||
              parentNode?.data.kind === 'csv' ||
              parentNode?.data.kind === 'pdf' ||
              parentNode?.data.kind === 'image'
            }
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
            onMove={({ dragIds, dragNodes, parentId, index }) => {
              const kind = dragNodes[0]?.data.kind
              if (kind === 'note') {
                moveNote({ workspaceId, noteId: dragIds[0], folderId: parentId ?? null, index })
              } else if (kind === 'csv') {
                moveCsvFile({ workspaceId, csvId: dragIds[0], folderId: parentId ?? null, index })
              } else if (kind === 'pdf') {
                movePdfFile({ workspaceId, pdfId: dragIds[0], folderId: parentId ?? null, index })
              } else if (kind === 'image') {
                moveImageFile({
                  workspaceId,
                  imageId: dragIds[0],
                  folderId: parentId ?? null,
                  index
                })
              } else {
                move({ workspaceId, folderId: dragIds[0], parentFolderId: parentId ?? null, index })
              }
            }}
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

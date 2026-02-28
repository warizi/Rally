import { JSX, useCallback, useRef, useState } from 'react'
import { Tree } from 'react-arborist'
import type { NodeApi, NodeRendererProps, TreeApi } from 'react-arborist'
import { ChevronsDownUp, FilePlus, FolderPlus } from 'lucide-react'
import {
  useCreateFolder,
  useRenameFolder,
  useRemoveFolder,
  useMoveFolder,
  useUpdateFolderMeta
} from '@entities/folder'
import { useCreateNote, useMoveNote, useRemoveNote } from '@entities/note'
import { useCreateCsvFile, useMoveCsvFile, useRemoveCsvFile } from '@entities/csv-file'
import { Button } from '@shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { useWorkspaceTree } from '../model/use-workspace-tree'
import { useTreeOpenState } from '../model/use-tree-open-state'
import type { WorkspaceTreeNode, FolderTreeNode, NoteTreeNode, CsvTreeNode } from '../model/types'
import { FolderColorDialog } from './FolderColorDialog'
import { FolderContextMenu } from './FolderContextMenu'
import { FolderNameDialog } from './FolderNameDialog'
import { FolderNodeRenderer } from './FolderNodeRenderer'
import { NoteContextMenu } from './NoteContextMenu'
import { NoteNodeRenderer } from './NoteNodeRenderer'
import { CsvContextMenu } from './CsvContextMenu'
import { CsvNodeRenderer } from './CsvNodeRenderer'
import { DeleteFolderDialog } from './DeleteFolderDialog'

interface Props {
  workspaceId: string
  tabId?: string // sourcePaneId 계산용 (FolderPage에서 전달)
}

export function FolderTree({ workspaceId, tabId }: Props): JSX.Element {
  const { tree } = useWorkspaceTree(workspaceId)
  const treeRef = useRef<TreeApi<WorkspaceTreeNode>>(null)
  const { openState, toggle, collapseAll } = useTreeOpenState(tabId)

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

  // Tab store
  const openRightTab = useTabStore((s) => s.openRightTab)
  const findPaneByTabId = useTabStore((s) => s.findPaneByTabId)
  const sourcePaneId = tabId ? (findPaneByTabId(tabId)?.id ?? '') : ''

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

      // kind === 'folder'
      return (
        <FolderContextMenu
          onCreateChild={() => setCreateTarget({ parentFolderId: props.node.id })}
          onCreateNote={() => handleCreateNote(props.node.id)}
          onCreateCsv={() => handleCreateCsv(props.node.id)}
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
    [sourcePaneId, handleCreateNote, handleCreateCsv, openRightTab]
  )

  return (
    <div className="flex flex-col h-full relative">
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
        <Tree<WorkspaceTreeNode>
          key={workspaceId}
          ref={treeRef}
          data={tree}
          idAccessor="id"
          initialOpenState={openState}
          openByDefault={false}
          childrenAccessor={(n) => (n.kind === 'folder' ? n.children : null)}
          disableDrop={({ parentNode }) =>
            parentNode?.data.kind === 'note' || parentNode?.data.kind === 'csv'
          }
          disableEdit={(n) => n.kind === 'note' || n.kind === 'csv'}
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
            } else {
              setDeleteTarget({ id: ids[0], name: firstNode.data.name })
            }
          }}
          width="100%"
          className="flex-1 overflow-auto px-2"
        >
          {NodeRenderer}
        </Tree>
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
            remove(
              { workspaceId, folderId: deleteTarget.id },
              { onSuccess: () => setDeleteTarget(null) }
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
              { onSuccess: () => setNoteDeleteTarget(null) }
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
              { onSuccess: () => setCsvDeleteTarget(null) }
            )
          }
        }}
      />
    </div>
  )
}

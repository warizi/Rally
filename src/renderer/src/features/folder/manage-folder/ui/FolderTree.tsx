import { JSX, useCallback, useState } from 'react'
import { Tree } from 'react-arborist'
import type { NodeApi, NodeRendererProps } from 'react-arborist'
import { FolderPlus } from 'lucide-react'
import {
  useFolderTree,
  useCreateFolder,
  useRenameFolder,
  useRemoveFolder,
  useMoveFolder,
  useUpdateFolderMeta
} from '@entities/folder'
import type { FolderNode } from '@entities/folder'
import { Button } from '@shared/ui/button'
import { FolderColorDialog } from './FolderColorDialog'
import { FolderContextMenu } from './FolderContextMenu'
import { FolderNameDialog } from './FolderNameDialog'
import { FolderNodeRenderer } from './FolderNodeRenderer'
import { DeleteFolderDialog } from './DeleteFolderDialog'

interface Props {
  workspaceId: string
}

export function FolderTree({ workspaceId }: Props): JSX.Element {
  const { data: tree = [] } = useFolderTree(workspaceId)
  const { mutate: create, isPending: isCreating } = useCreateFolder()
  const { mutate: rename, isPending: isRenaming } = useRenameFolder()
  const { mutate: remove, isPending: isRemoving } = useRemoveFolder()
  const { mutate: move } = useMoveFolder()
  const { mutate: updateMeta, isPending: isUpdatingMeta } = useUpdateFolderMeta()

  const [createTarget, setCreateTarget] = useState<{ parentFolderId: string | null } | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null)
  const [colorTarget, setColorTarget] = useState<{ id: string; color: string | null } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const NodeRenderer = useCallback(
    (props: NodeRendererProps<FolderNode>) => (
      <FolderContextMenu
        onCreateChild={() => setCreateTarget({ parentFolderId: props.node.id })}
        onRename={() => setRenameTarget({ id: props.node.id, name: props.node.data.name })}
        onEditColor={() => setColorTarget({ id: props.node.id, color: props.node.data.color })}
        onDelete={() => setDeleteTarget({ id: props.node.id, name: props.node.data.name })}
      >
        <div>
          <FolderNodeRenderer {...props} />
        </div>
      </FolderContextMenu>
    ),
    []
  )

  return (
    <div className="flex flex-col h-full">
      {/* 툴바 */}
      <div className="flex items-center justify-between py-2 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          폴더
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => setCreateTarget({ parentFolderId: null })}
          title="루트 폴더 추가"
        >
          <FolderPlus className="size-3.5" />
        </Button>
      </div>

      {/* 트리 또는 빈 상태 */}
      {tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground px-4">
          <FolderPlus className="size-8 opacity-30" />
          <p className="text-xs text-center">폴더가 없습니다.</p>
          <p className="text-xs text-center opacity-70">위의 + 버튼으로 폴더를 추가하세요.</p>
        </div>
      ) : (
        <Tree<FolderNode>
          data={tree}
          idAccessor="id"
          childrenAccessor="children"
          onCreate={({ parentId }) => {
            setCreateTarget({ parentFolderId: parentId ?? null })
            return null
          }}
          onRename={({ id, name }) => {
            rename({ workspaceId, folderId: id, newName: name })
          }}
          onMove={({ dragIds, parentId, index }) => {
            move({ workspaceId, folderId: dragIds[0], parentFolderId: parentId ?? null, index })
          }}
          onDelete={({ ids, nodes }: { ids: string[]; nodes: NodeApi<FolderNode>[] }) => {
            if (nodes.length === 0) return
            setDeleteTarget({ id: ids[0], name: nodes[0].data.name })
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
        isPending={isCreating}
        onSubmit={(name) => {
          if (createTarget) {
            create(
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
    </div>
  )
}

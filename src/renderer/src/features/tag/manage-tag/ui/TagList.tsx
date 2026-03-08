import { useState, useMemo, useCallback } from 'react'
import {
  useItemTags,
  useTags,
  useAttachTag,
  useDetachTag,
  useCreateTag,
  useUpdateTag,
  useRemoveTag,
  TagBadge
} from '@entities/tag'
import type { TagItem, TaggableEntityType } from '@entities/tag'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@shared/ui/alert-dialog'
import { TagPicker } from './TagPicker'
import { TagCreateDialog } from './TagCreateDialog'
import { TagUpdateDialog } from './TagUpdateDialog'

interface Props {
  workspaceId: string
  itemType: TaggableEntityType
  itemId: string
}

export function TagList({ workspaceId, itemType, itemId }: Props): React.JSX.Element {
  const { data: itemTags = [] } = useItemTags(itemType, itemId)
  const { data: allTags = [] } = useTags(workspaceId)
  const attachTag = useAttachTag()
  const detachTag = useDetachTag()
  const createTag = useCreateTag()
  const updateTag = useUpdateTag()
  const removeTag = useRemoveTag()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTag, setEditTag] = useState<TagItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TagItem | null>(null)

  const attachedTagIds = useMemo(() => new Set(itemTags.map((t) => t.id)), [itemTags])

  const handleToggle = useCallback(
    (tag: TagItem) => {
      if (attachedTagIds.has(tag.id)) {
        detachTag.mutate({ itemType, tagId: tag.id, itemId })
      } else {
        attachTag.mutate({ itemType, tagId: tag.id, itemId })
      }
    },
    [attachedTagIds, attachTag, detachTag, itemType, itemId]
  )

  const handleCreate = useCallback(
    (data: { name: string; color: string; description?: string }) => {
      createTag.mutate(
        { workspaceId, input: data },
        {
          onSuccess: (newTag) => {
            setCreateOpen(false)
            if (newTag) {
              attachTag.mutate({ itemType, tagId: newTag.id, itemId })
            }
          }
        }
      )
    },
    [createTag, attachTag, workspaceId, itemType, itemId]
  )

  const handleUpdate = useCallback(
    (data: { name?: string; color?: string; description?: string | null }) => {
      if (!editTag) return
      updateTag.mutate(
        { id: editTag.id, input: data, workspaceId },
        { onSuccess: () => setEditTag(null) }
      )
    },
    [editTag, updateTag, workspaceId]
  )

  const handleRemoveTag = useCallback(() => {
    if (editTag) {
      setDeleteTarget(editTag)
    }
  }, [editTag])

  const handleRequestRemove = useCallback((tag: TagItem) => {
    setDeleteTarget(tag)
  }, [])

  const handleConfirmRemove = useCallback(() => {
    if (!deleteTarget) return
    removeTag.mutate(
      { id: deleteTarget.id, workspaceId },
      {
        onSuccess: () => {
          if (editTag?.id === deleteTarget.id) setEditTag(null)
          setDeleteTarget(null)
        }
      }
    )
  }, [deleteTarget, editTag, removeTag, workspaceId])

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-xs text-muted-foreground mr-0.5">태그</span>
      {itemTags.map((tag) => (
        <div
          key={tag.id}
          role="button"
          tabIndex={0}
          className="cursor-pointer"
          onClick={() => setEditTag(tag)}
          onKeyDown={(e) => e.key === 'Enter' && setEditTag(tag)}
        >
          <TagBadge
            tag={tag}
            onRemove={() => detachTag.mutate({ itemType, tagId: tag.id, itemId })}
          />
        </div>
      ))}

      <TagPicker
        allTags={allTags}
        attachedTagIds={attachedTagIds}
        onToggle={handleToggle}
        onCreateClick={() => setCreateOpen(true)}
        onRemove={handleRequestRemove}
      />

      <TagCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        isPending={createTag.isPending}
        onSubmit={handleCreate}
      />

      {editTag && (
        <TagUpdateDialog
          open={!!editTag}
          onOpenChange={(open) => !open && setEditTag(null)}
          tag={editTag}
          isPending={updateTag.isPending}
          onSubmit={handleUpdate}
          onRemove={handleRemoveTag}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>태그 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &lsquo;{deleteTarget?.name}&rsquo; 태그를 삭제하면 모든 항목에서 이 태그가 제거됩니다.
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

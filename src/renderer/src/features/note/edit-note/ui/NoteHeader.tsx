import { JSX } from 'react'
import TabHeader from '@shared/ui/tab-header'
import { useRenameNote, useUpdateNoteMeta, useNotesByWorkspace } from '@entities/note'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { LinkedEntityPopoverButton } from '@features/entity-link/manage-link'

interface NoteHeaderProps {
  workspaceId: string
  noteId: string
  tabId?: string
}

export function NoteHeader({ workspaceId, noteId, tabId }: NoteHeaderProps): JSX.Element {
  const { data: notes } = useNotesByWorkspace(workspaceId)
  const note = notes?.find((n) => n.id === noteId)

  const { mutate: renameNote } = useRenameNote()
  const { mutate: updateMeta } = useUpdateNoteMeta()
  const setTabTitle = useTabStore((s) => s.setTabTitle)

  return (
    <TabHeader
      editable
      title={note?.title ?? ''}
      description={note?.description ?? ''}
      buttons={
        <LinkedEntityPopoverButton
          entityType="note"
          entityId={noteId}
          workspaceId={workspaceId}
        />
      }
      onTitleChange={(title) => {
        renameNote({ workspaceId, noteId, newName: title })
        if (tabId) setTabTitle(tabId, title)
      }}
      onDescriptionChange={(desc) => {
        updateMeta({ workspaceId, noteId, data: { description: desc } })
      }}
    />
  )
}

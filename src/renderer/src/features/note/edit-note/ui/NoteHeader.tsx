import { JSX } from 'react'
import TabHeader from '@shared/ui/tab-header'
import { OnboardingTipIcon } from '@shared/ui/onboarding-tip'
import {
  useRenameNote,
  useUpdateNoteMeta,
  useNotesByWorkspace,
  useReadNoteContent,
  useWriteNoteContent
} from '@entities/note'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { LinkedEntityPopoverButton } from '@features/entity-link/manage-link'
import { TagList } from '@features/tag/manage-tag'
import { TemplateButton } from '@features/template/manage-template'

interface NoteHeaderProps {
  workspaceId: string
  noteId: string
  tabId?: string
}

export function NoteHeader({ workspaceId, noteId, tabId }: NoteHeaderProps): JSX.Element {
  const { data: notes } = useNotesByWorkspace(workspaceId)
  const note = notes?.find((n) => n.id === noteId)
  const { data: content } = useReadNoteContent(workspaceId, noteId)

  const { mutate: renameNote } = useRenameNote()
  const { mutate: updateMeta } = useUpdateNoteMeta()
  const { mutate: writeContent } = useWriteNoteContent()
  const setTabTitle = useTabStore((s) => s.setTabTitle)

  const currentContent = content ?? ''

  return (
    <TabHeader
      editable
      title={note?.title ?? ''}
      description={note?.description ?? ''}
      buttons={
        <div className="flex items-center gap-1">
          <OnboardingTipIcon
            tipId="note_markdown"
            title="마크다운 지원"
            description="`# 제목`, `**굵게**`, `- 리스트`, `[링크](...)`, 코드 블록 등 마크다운 문법을 그대로 사용할 수 있어요."
          />
          <TemplateButton
            workspaceId={workspaceId}
            type="note"
            getJsonData={() => currentContent}
            hasContent={currentContent.trim().length > 0}
            onApply={(jsonData) => writeContent({ workspaceId, noteId, content: jsonData })}
          />
          <LinkedEntityPopoverButton
            entityType="note"
            entityId={noteId}
            workspaceId={workspaceId}
          />
        </div>
      }
      footer={<TagList workspaceId={workspaceId} itemType="note" itemId={noteId} />}
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

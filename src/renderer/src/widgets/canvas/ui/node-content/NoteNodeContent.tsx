import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useReadNoteContent } from '@entities/note'
import { NoteEditor } from '@features/note/edit-note'
import { ScrollArea } from '@shared/ui/scroll-area'
import type { NodeContentProps } from '../../model/node-content-registry'

export function NoteNodeContent({ refId }: NodeContentProps): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const { data: content, isLoading } = useReadNoteContent(workspaceId, refId ?? '')

  if (isLoading) {
    return <div className="p-3 flex-1 text-xs text-muted-foreground">불러오는 중...</div>
  }

  return (
    <ScrollArea className="flex-1 min-h-0 nowheel">
      <div className="p-3">
        <NoteEditor workspaceId={workspaceId} noteId={refId ?? ''} initialContent={content ?? ''} />
      </div>
    </ScrollArea>
  )
}

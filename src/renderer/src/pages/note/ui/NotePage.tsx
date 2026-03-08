import { JSX, useEffect } from 'react'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useReadNoteContent } from '@entities/note'
import { NoteEditor, NoteHeader } from '@features/note/edit-note'
import { FolderX } from 'lucide-react'
import { useTabStore } from '@/features/tap-system/manage-tab-system'

// @app import 대신 인라인 타입 (FSD 위반 방지: pages → app 금지)
export function NotePage({
  tabId,
  params
}: {
  tabId?: string
  params?: Record<string, string>
}): JSX.Element {
  const noteId = params?.noteId ?? ''
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const setTabError = useTabStore((s) => s.setTabError)

  const { data: content, isLoading, isError } = useReadNoteContent(workspaceId, noteId)

  useEffect(() => {
    if (tabId && isError) {
      setTabError(tabId, true)
    }
  }, [isError, tabId, setTabError])

  if (!noteId || !workspaceId) {
    return (
      <TabContainer header={null}>
        <div className="text-sm text-muted-foreground p-4">노트 정보가 없습니다.</div>
      </TabContainer>
    )
  }

  if (isLoading) {
    return (
      <TabContainer header={<TabHeader isLoading />}>
        <div />
      </TabContainer>
    )
  }

  if (isError) {
    return (
      <TabContainer header={null}>
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground mt-20">
          <FolderX className="size-12" />
          <p className="text-sm">노트 불러오기를 실패하였습니다.</p>
          <p className="text-xs">이 탭을 닫아주세요.</p>
        </div>
      </TabContainer>
    )
  }

  return (
    <TabContainer header={<NoteHeader workspaceId={workspaceId} noteId={noteId} tabId={tabId} />}>
      <NoteEditor workspaceId={workspaceId} noteId={noteId} initialContent={content ?? ''} />
    </TabContainer>
  )
}

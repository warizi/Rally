import { useMemo } from 'react'
import { FileText } from 'lucide-react'
import { useNotesByWorkspace } from '@entities/note'
import type { NoteNode } from '@entities/note'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { ROUTES } from '@shared/constants/tab-url'
import { Badge } from '@shared/ui/badge'
import { Button } from '@shared/ui/button'
import { DashboardCard } from '@shared/ui/dashboard-card'

interface RecentNotesCardProps {
  workspaceId: string
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return date.toLocaleDateString('ko-KR')
}

export function RecentNotesCard({ workspaceId }: RecentNotesCardProps): React.JSX.Element {
  const { data: notes = [], isLoading } = useNotesByWorkspace(workspaceId)
  const openTab = useTabStore((s) => s.openTab)

  const recentNotes = useMemo(
    () =>
      [...notes]
        .sort((a: NoteNode, b: NoteNode) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 5),
    [notes]
  )

  const handleClick = (note: NoteNode): void => {
    openTab({
      type: 'note',
      pathname: ROUTES.NOTE_DETAIL.replace(':noteId', note.id),
      title: note.title
    })
  }

  const handleViewAll = (): void => {
    openTab({ type: 'folder', pathname: ROUTES.FOLDER, title: '파일 탐색기' })
  }

  return (
    <DashboardCard
      title="최근 노트"
      icon={FileText}
      isLoading={isLoading}
      action={
        <div className="flex items-center gap-1">
          {notes.length > 0 && <Badge variant="secondary">{notes.length}</Badge>}
          <Button variant="ghost" size="sm" className="text-xs" onClick={handleViewAll}>
            모두 보기
          </Button>
        </div>
      }
    >
      {recentNotes.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">노트가 없습니다</p>
          <Button variant="outline" size="sm" onClick={handleViewAll}>
            파일 탐색기 열기
          </Button>
        </div>
      ) : (
        <div className="space-y-0.5">
          {recentNotes.map((note) => (
            <button
              key={note.id}
              className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
              onClick={() => handleClick(note)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm">{note.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatRelativeTime(note.updatedAt)}
                </span>
              </div>
              {note.preview && (
                <p className="truncate text-xs text-muted-foreground">{note.preview}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}

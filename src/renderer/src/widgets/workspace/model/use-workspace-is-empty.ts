import { useNotesByWorkspace } from '@entities/note'
import { useCanvasesByWorkspace } from '@entities/canvas'
import { useTodosByWorkspace } from '@entities/todo'
import { useAllSchedulesByWorkspace } from '@entities/schedule'

interface WorkspaceEmptiness {
  isEmpty: boolean
  isLoading: boolean
  counts: {
    notes: number
    canvases: number
    todos: number
    schedules: number
  }
}

export function useWorkspaceIsEmpty(workspaceId: string | null | undefined): WorkspaceEmptiness {
  const notesQ = useNotesByWorkspace(workspaceId ?? '')
  const canvasesQ = useCanvasesByWorkspace(workspaceId ?? null)
  const todosQ = useTodosByWorkspace(workspaceId ?? null)
  const schedulesQ = useAllSchedulesByWorkspace(workspaceId ?? null)

  const counts = {
    notes: notesQ.data?.length ?? 0,
    canvases: canvasesQ.data?.length ?? 0,
    todos: todosQ.data?.length ?? 0,
    schedules: schedulesQ.data?.length ?? 0
  }

  const isLoading =
    notesQ.isLoading || canvasesQ.isLoading || todosQ.isLoading || schedulesQ.isLoading
  const isEmpty =
    !isLoading &&
    counts.notes === 0 &&
    counts.canvases === 0 &&
    counts.todos === 0 &&
    counts.schedules === 0

  return { isEmpty, isLoading, counts }
}

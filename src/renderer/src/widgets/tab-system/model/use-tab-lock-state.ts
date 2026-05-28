import { Tab } from '@/entities/tab-system'
import { useNotesByWorkspace, useToggleNoteLock } from '@entities/note'
import { useCsvFilesByWorkspace, useToggleCsvLock } from '@entities/csv-file'
import { useCanvasesByWorkspace, useToggleCanvasLock } from '@entities/canvas'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'

export interface TabLockState {
  /** 잠금 가능한 탭인지 (note / csv / canvas-detail) */
  isLockable: boolean
  /** 현재 잠금 상태 */
  isLocked: boolean
  /** 잠금 토글. 비가능 탭이면 no-op */
  toggle: () => void
}

function extractTrailingId(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix + '/')) return null
  const rest = pathname.slice(prefix.length + 1)
  if (!rest || rest.includes('/')) return null
  return rest
}

/**
 * 탭의 lockable 여부 + 현재 잠금 상태 + 토글 함수를 반환.
 * Tab 컴포넌트 단위로 사용. workspace 리스트 query를 공유하므로 React Query 캐시 hit.
 */
export function useTabLockState(tab: Tab): TabLockState {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''

  const noteId = tab.icon === 'note' ? extractTrailingId(tab.pathname, '/folder/note') : null
  const csvId = tab.icon === 'csv' ? extractTrailingId(tab.pathname, '/folder/csv') : null
  const canvasId = tab.icon === 'canvas-detail' ? extractTrailingId(tab.pathname, '/canvas') : null

  const notes = useNotesByWorkspace(workspaceId)
  const csvs = useCsvFilesByWorkspace(workspaceId)
  const canvases = useCanvasesByWorkspace(workspaceId)

  const toggleNote = useToggleNoteLock()
  const toggleCsv = useToggleCsvLock()
  const toggleCanvas = useToggleCanvasLock()

  if (noteId && workspaceId) {
    const note = notes.data?.find((n) => n.id === noteId)
    const isLocked = note?.isLocked ?? false
    return {
      isLockable: true,
      isLocked,
      toggle: () => toggleNote.mutate({ workspaceId, noteId, isLocked: !isLocked })
    }
  }
  if (csvId && workspaceId) {
    const csv = csvs.data?.find((c) => c.id === csvId)
    const isLocked = csv?.isLocked ?? false
    return {
      isLockable: true,
      isLocked,
      toggle: () => toggleCsv.mutate({ workspaceId, csvId, isLocked: !isLocked })
    }
  }
  if (canvasId && workspaceId) {
    const canvas = canvases.data?.find((c) => c.id === canvasId)
    const isLocked = canvas?.isLocked ?? false
    return {
      isLockable: true,
      isLocked,
      toggle: () => toggleCanvas.mutate({ canvasId, isLocked: !isLocked, workspaceId })
    }
  }

  return { isLockable: false, isLocked: false, toggle: () => {} }
}

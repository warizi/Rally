import { useCallback, useState } from 'react'

const STORAGE_KEY = 'folder-tree-open-state'

function load(workspaceId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${workspaceId}`)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function save(workspaceId: string, state: Record<string, boolean>): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${workspaceId}`, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

/**
 * workspace별 폴더 트리 열림/닫힘 상태를 localStorage에 영속
 */
export function useTreeOpenState(workspaceId: string): {
  openState: Record<string, boolean>
  toggle: (id: string, isOpen: boolean) => void
} {
  const [openState, setOpenState] = useState<Record<string, boolean>>(() => load(workspaceId))

  const toggle = useCallback(
    (id: string, isOpen: boolean) => {
      setOpenState((prev) => {
        const next = { ...prev, [id]: isOpen }
        save(workspaceId, next)
        return next
      })
    },
    [workspaceId]
  )

  return { openState, toggle }
}

import { useCallback, useMemo } from 'react'
import { useTabStore } from '@features/tap-system/manage-tab-system'

const OPEN_STATE_KEY = 'folderOpenState'

function parseOpenState(raw: string | undefined): Record<string, boolean> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, boolean>
  } catch {
    return {}
  }
}

/**
 * 폴더 트리 열림/닫힘 상태를 탭 searchParams에 영속
 */
export function useTreeOpenState(tabId: string | undefined): {
  openState: Record<string, boolean>
  toggle: (id: string, isOpen: boolean) => void
  collapseAll: () => void
} {
  const searchParams = useTabStore((s) => (tabId ? s.tabs[tabId]?.searchParams : undefined))
  const navigateTab = useTabStore((s) => s.navigateTab)

  const openState = useMemo(() => parseOpenState(searchParams?.[OPEN_STATE_KEY]), [searchParams])

  const toggle = useCallback(
    (id: string, isOpen: boolean) => {
      if (!tabId) return
      const current = parseOpenState(searchParams?.[OPEN_STATE_KEY])
      const next = { ...current, [id]: isOpen }
      navigateTab(tabId, {
        searchParams: { ...searchParams, [OPEN_STATE_KEY]: JSON.stringify(next) }
      })
    },
    [tabId, searchParams, navigateTab]
  )

  const collapseAll = useCallback(() => {
    if (!tabId) return
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [OPEN_STATE_KEY]: _, ...rest } = searchParams ?? {}
    navigateTab(tabId, { searchParams: rest })
  }, [tabId, searchParams, navigateTab])

  return { openState, toggle, collapseAll }
}

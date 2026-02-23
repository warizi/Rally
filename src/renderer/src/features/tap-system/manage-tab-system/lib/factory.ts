import { Pane, PaneNode, SplitDirection, SplitNode, Tab } from '@/entities/tab-system'
import { TabOptions, TabState } from '../model/types'
import { LAYOUT_DEFAULTS, PANE_DEFAULTS } from './contants'
import { nanoid } from 'nanoid'

// ID 생성
export function createTabId(pathname: string): string {
  return `tab-${pathname
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')}`
}

// tab 생성
export function createTab(options: TabOptions): Tab {
  const now = Date.now()
  return {
    id: createTabId(options.pathname),
    type: options.type,
    title: options.title,
    icon: options.type,
    pathname: options.pathname,
    searchParams: options.searchParams,
    pinned: options.pinned ?? false,
    createdAt: now,
    lastAccessedAt: now
  }
}

// pane 생성
export function createPane(options?: {
  id?: string
  tabIds?: string[]
  activeTabId?: string | null
  size?: number
  minSize?: number
}): Pane {
  return {
    id: options?.id ?? nanoid(),
    tabIds: options?.tabIds ?? [],
    activeTabId: options?.activeTabId ?? null,
    size: options?.size ?? PANE_DEFAULTS.DEFAULT_SIZE,
    minSize: options?.minSize ?? PANE_DEFAULTS.MIN_SIZE
  }
}

// pane 노드 생성
export function createPaneNode(paneId: string): PaneNode {
  return { id: nanoid(), type: 'pane', paneId }
}

// 분할 노드 생성
export function createSplitContainerNode(
  direction: SplitDirection,
  children: (PaneNode | SplitNode)[],
  sizes?: number[]
): SplitNode {
  return {
    id: nanoid(),
    type: 'split',
    direction,
    children,
    sizes: sizes ?? children.map(() => 100 / children.length)
  }
}

// 초기 상태 생성
export function createInitialState(): TabState {
  const dashboardTab = createTab({
    type: 'dashboard',
    pathname: '/dashboard',
    title: '대시보드'
  })

  const mainPane = createPane({
    id: LAYOUT_DEFAULTS.DEFAULT_PANE_ID,
    tabIds: [dashboardTab.id],
    activeTabId: dashboardTab.id
  })

  const layout: PaneNode = { id: nanoid(), type: 'pane', paneId: mainPane.id }

  return {
    tabs: { [dashboardTab.id]: dashboardTab },
    panes: { [mainPane.id]: mainPane },
    layout,
    activePaneId: mainPane.id
  }
}

// search 문자열을 객체로 파싱
export function parseSearch(search: string): Record<string, string> {
  if (!search) return {}
  const queryString = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(queryString)
  const result: Record<string, string> = {}
  params.forEach((value, key) => {
    result[key] = value
  })
  return result
}

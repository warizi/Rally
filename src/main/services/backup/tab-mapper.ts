import { nanoid } from 'nanoid'
import type { IdMapper, BackupEntityType } from './id-mapper'
import type { MappedTabSession } from './types'

/**
 * 탭 세션 JSON 내부 ID 재매핑.
 *
 * tabSessions / tabSnapshots 의 tabsJson / panesJson / layoutJson 은 모두
 * entity ID 문자열을 직접 포함 — DB 외래키로 표현되지 않은 "암묵 참조".
 *
 * import 시 IdMapper 로 entity ID 가 새 ID 로 바뀌면, JSON 내부 참조도
 * 함께 재매핑해야 탭이 올바른 entity 를 가리킨다.
 *
 * Phase 4 의 tab-session-remapper.ts 에서 더 정밀한 RefSchema 기반 매핑
 * 으로 발전 예정. 현재는 backup.ts 원본 로직 그대로 이전.
 */

/** pathname pattern 별 entity type 매핑 */
const PATHNAME_PATTERNS: { regex: RegExp; type: BackupEntityType }[] = [
  { regex: /^\/todo\/(.+)$/, type: 'todo' },
  { regex: /^\/folder\/note\/(.+)$/, type: 'note' },
  { regex: /^\/folder\/csv\/(.+)$/, type: 'csv' },
  { regex: /^\/folder\/pdf\/(.+)$/, type: 'pdf' },
  { regex: /^\/folder\/image\/(.+)$/, type: 'image' },
  { regex: /^\/canvas\/(.+)$/, type: 'canvas' }
]

/** pathname 에서 마지막 세그먼트(엔티티 ID) 교체 */
export function mapTabPathname(
  pathname: string,
  mapper: IdMapper
): { pathname: string; mapped: boolean } {
  for (const { regex, type } of PATHNAME_PATTERNS) {
    const match = pathname.match(regex)
    if (match) {
      const oldId = match[1]
      const newId = mapper.mapOrSkip(type, oldId)
      if (!newId) return { pathname, mapped: false }
      return {
        pathname: pathname.replace(oldId, newId),
        mapped: true
      }
    }
  }

  // 엔티티 ID 없는 경로 (dashboard, todo list, folder list 등)
  return { pathname, mapped: true }
}

/** createTabId 알고리즘 재현 (renderer factory.ts 와 동일) */
export function createTabId(pathname: string): string {
  return `tab-${pathname
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')}`
}

/** folderOpenState JSON 키 매핑 */
export function mapFolderOpenState(
  json: string | undefined,
  mapper: IdMapper
): string | undefined {
  if (!json) return json
  try {
    const parsed: Record<string, boolean> = JSON.parse(json)
    const mapped: Record<string, boolean> = {}
    for (const [oldFolderId, value] of Object.entries(parsed)) {
      const newId = mapper.mapOrSkip('folder', oldFolderId)
      if (newId) mapped[newId] = value
    }
    return JSON.stringify(mapped)
  } catch {
    return json
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * tab_sessions / tab_snapshots JSON 전체 매핑.
 *
 * `any` 사용은 tab/pane JSON 의 동적 구조 — Phase 3-4 에서 zod 스키마
 * + 제네릭 도입 시 함께 제거 예정. 현재는 원본 동작 보존이 우선.
 */
export function mapTabJsons(
  tabsJsonStr: string,
  panesJsonStr: string,
  layoutJsonStr: string,
  activePaneId: string | null,
  mapper: IdMapper
): MappedTabSession {
  // 1. tabs 매핑
  const oldTabs: Record<string, any> = JSON.parse(tabsJsonStr)
  const tabIdMap = new Map<string, string>()
  const newTabs: Record<string, any> = {}

  for (const [oldTabId, tab] of Object.entries(oldTabs)) {
    const result = mapTabPathname(tab.pathname, mapper)
    if (!result.mapped) continue

    const newPathname = result.pathname
    const newTabId = createTabId(newPathname)
    tabIdMap.set(oldTabId, newTabId)

    const searchParams = tab.searchParams ? { ...tab.searchParams } : undefined
    if (searchParams?.folderOpenState) {
      searchParams.folderOpenState = mapFolderOpenState(searchParams.folderOpenState, mapper)
    }

    newTabs[newTabId] = {
      ...tab,
      id: newTabId,
      pathname: newPathname,
      searchParams
    }
  }

  // 2. panes 매핑
  const oldPanes: Record<string, any> = JSON.parse(panesJsonStr)
  const paneIdMap = new Map<string, string>()
  const newPanes: Record<string, any> = {}

  for (const [oldPaneId, pane] of Object.entries(oldPanes)) {
    const newPaneId = nanoid()
    paneIdMap.set(oldPaneId, newPaneId)

    const newTabIds = pane.tabIds.map((oldId: string) => tabIdMap.get(oldId)).filter(Boolean)

    const newActiveTabId = pane.activeTabId ? (tabIdMap.get(pane.activeTabId) ?? null) : null

    newPanes[newPaneId] = {
      ...pane,
      id: newPaneId,
      tabIds: newTabIds,
      activeTabId: newActiveTabId ?? newTabIds[0] ?? null
    }
  }

  // 3. layout 매핑 (재귀)
  function mapLayout(node: any): any {
    if (node.type === 'pane') {
      return { ...node, id: nanoid(), paneId: paneIdMap.get(node.paneId) ?? node.paneId }
    }
    if (node.type === 'split') {
      return { ...node, id: nanoid(), children: node.children.map(mapLayout) }
    }
    return node
  }

  const oldLayout = JSON.parse(layoutJsonStr)
  const newLayout = mapLayout(oldLayout)

  // 4. activePaneId 매핑
  const newActivePaneId = activePaneId
    ? (paneIdMap.get(activePaneId) ?? Object.keys(newPanes)[0] ?? '')
    : (Object.keys(newPanes)[0] ?? '')

  return {
    tabsJson: JSON.stringify(newTabs),
    panesJson: JSON.stringify(newPanes),
    layoutJson: JSON.stringify(newLayout),
    activePaneId: newActivePaneId
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

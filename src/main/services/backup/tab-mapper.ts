import { nanoid } from 'nanoid'
import type { IdMapper, BackupEntityType } from './id-mapper'
import type { MappedTabSession } from './types'
import {
  TabsMapSchema,
  PanesMapSchema,
  LayoutNodeSchema,
  type TabImport,
  type PaneImport,
  type LayoutNodeImport
} from './tab-schemas'

/**
 * 탭 세션 JSON 내부 ID 재매핑.
 *
 * tabSessions / tabSnapshots 의 tabsJson / panesJson / layoutJson 은 모두
 * entity ID 문자열을 직접 포함 — DB 외래키로 표현되지 않은 "암묵 참조".
 *
 * import 시 IdMapper 로 entity ID 가 새 ID 로 바뀌면, JSON 내부 참조도
 * 함께 재매핑해야 탭이 올바른 entity 를 가리킨다.
 *
 * P0-2 Phase 4: tab-schemas.ts 의 zod 스키마로 any 제거. 손상된 tab JSON 은
 * 즉시 throw (silent fallback 0).
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

/** folderOpenState JSON 키 매핑. 손상된 JSON 은 throw (silent fallback 0). */
export function mapFolderOpenState(json: string | undefined, mapper: IdMapper): string | undefined {
  if (!json) return json
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (e) {
    throw new Error(`Invalid folderOpenState JSON: ${(e as Error).message}`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid folderOpenState: expected an object map<folderId, boolean>')
  }
  const mapped: Record<string, boolean> = {}
  for (const [oldFolderId, value] of Object.entries(parsed)) {
    if (typeof value !== 'boolean') {
      throw new Error(
        `Invalid folderOpenState entry: '${oldFolderId}' value is not boolean (got ${typeof value})`
      )
    }
    const newId = mapper.mapOrSkip('folder', oldFolderId)
    if (newId) mapped[newId] = value
  }
  return JSON.stringify(mapped)
}

/**
 * tab_sessions / tab_snapshots JSON 전체 매핑.
 *
 * zod 스키마로 입력 검증 — 손상된 구조는 ZodError throw.
 */
export function mapTabJsons(
  tabsJsonStr: string,
  panesJsonStr: string,
  layoutJsonStr: string,
  activePaneId: string | null,
  mapper: IdMapper
): MappedTabSession {
  // 1. tabs 매핑
  const oldTabsRaw: unknown = JSON.parse(tabsJsonStr)
  const tabsParsed = TabsMapSchema.safeParse(oldTabsRaw)
  if (!tabsParsed.success) {
    throw new Error(`Invalid tabsJson: ${tabsParsed.error.message}`)
  }
  const oldTabs = tabsParsed.data
  const tabIdMap = new Map<string, string>()
  const newTabs: Record<string, TabImport> = {}

  for (const [oldTabId, tab] of Object.entries(oldTabs)) {
    const result = mapTabPathname(tab.pathname, mapper)
    if (!result.mapped) continue

    const newPathname = result.pathname
    const newTabId = createTabId(newPathname)
    tabIdMap.set(oldTabId, newTabId)

    let searchParams = tab.searchParams ? { ...tab.searchParams } : undefined
    if (searchParams?.folderOpenState) {
      const mapped = mapFolderOpenState(searchParams.folderOpenState, mapper)
      if (mapped !== undefined) {
        searchParams = { ...searchParams, folderOpenState: mapped }
      }
    }

    newTabs[newTabId] = {
      ...tab,
      id: newTabId,
      pathname: newPathname,
      searchParams,
      // 구버전 백업에 icon 누락 시 type을 fallback으로 (TabIcon = TabType 이므로 동일 값).
      icon: tab.icon ?? tab.type
    }
  }

  // 2. panes 매핑
  const oldPanesRaw: unknown = JSON.parse(panesJsonStr)
  const panesParsed = PanesMapSchema.safeParse(oldPanesRaw)
  if (!panesParsed.success) {
    throw new Error(`Invalid panesJson: ${panesParsed.error.message}`)
  }
  const oldPanes = panesParsed.data
  const paneIdMap = new Map<string, string>()
  const newPanes: Record<string, PaneImport> = {}

  for (const [oldPaneId, pane] of Object.entries(oldPanes)) {
    const newPaneId = nanoid()
    paneIdMap.set(oldPaneId, newPaneId)

    const newTabIds = pane.tabIds
      .map((oldId) => tabIdMap.get(oldId))
      .filter((v): v is string => v !== undefined)

    const newActiveTabId = pane.activeTabId ? (tabIdMap.get(pane.activeTabId) ?? null) : null

    newPanes[newPaneId] = {
      ...pane,
      id: newPaneId,
      tabIds: newTabIds,
      activeTabId: newActiveTabId ?? newTabIds[0] ?? null
    }
  }

  // 3. layout 매핑 (재귀)
  function mapLayout(node: LayoutNodeImport): LayoutNodeImport {
    if (node.type === 'pane') {
      return { ...node, id: nanoid(), paneId: paneIdMap.get(node.paneId) ?? node.paneId }
    }
    // type === 'split'
    return { ...node, id: nanoid(), children: node.children.map(mapLayout) }
  }

  const oldLayoutRaw: unknown = JSON.parse(layoutJsonStr)
  const layoutParsed = LayoutNodeSchema.safeParse(oldLayoutRaw)
  if (!layoutParsed.success) {
    throw new Error(`Invalid layoutJson: ${layoutParsed.error.message}`)
  }
  const newLayout = mapLayout(layoutParsed.data)

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

import { and, eq, gte, inArray, isNotNull, lte, or } from 'drizzle-orm'
import { db } from '../db'
import {
  todos,
  entityLinks,
  notes,
  csvFiles,
  pdfFiles,
  imageFiles,
  canvases,
  recurringCompletions
} from '../db/schema'

export type HistoryLinkType = 'note' | 'csv' | 'pdf' | 'image' | 'canvas'

export interface HistoryLink {
  type: HistoryLinkType
  id: string
  title: string
  description: string | null
}

export type HistoryEntryKind = 'todo' | 'recurring'

export interface HistoryTodoEntry {
  id: string
  title: string
  doneAt: Date
  links: HistoryLink[]
  kind: HistoryEntryKind
}

export interface HistoryDay {
  /** YYYY-MM-DD (local date of doneAt) */
  date: string
  todos: HistoryTodoEntry[]
}

export interface HistoryFetchOptions {
  /** 활동 있는 day 기준 offset (0 = 가장 최근 활동일) */
  dayOffset?: number
  /** 활동 있는 day 기준 limit (기본 10) */
  dayLimit?: number
  /** YYYY-MM-DD inclusive */
  fromDate?: string | null
  /** YYYY-MM-DD inclusive */
  toDate?: string | null
  /** todo 제목 + 링크된 파일 제목 부분 일치 (case-insensitive) */
  query?: string | null
}

export interface HistoryFetchResult {
  days: HistoryDay[]
  /** 다음 페이지 가능 여부 */
  hasMore: boolean
  /** 다음 호출 시 사용할 dayOffset */
  nextDayOffset: number
}

/** Date → 'YYYY-MM-DD' (local time zone) */
function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** YYYY-MM-DD → start of day (local) Date */
function dateKeyToStartOfDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0)
}

/** YYYY-MM-DD → end of day (local) Date */
function dateKeyToEndOfDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999)
}

interface LinkMeta {
  type: HistoryLinkType
  title: string
  description: string | null
}

/** 링크된 entity 타입별로 ID 그룹화하고 제목+설명 일괄 fetch */
function fetchLinkMeta(ids: { type: HistoryLinkType; id: string }[]): Map<string, LinkMeta> {
  const byType: Record<HistoryLinkType, string[]> = {
    note: [],
    csv: [],
    pdf: [],
    image: [],
    canvas: []
  }
  for (const { type, id } of ids) {
    byType[type].push(id)
  }

  const result = new Map<string, LinkMeta>()

  if (byType.note.length > 0) {
    const rows = db
      .select({ id: notes.id, title: notes.title, description: notes.description })
      .from(notes)
      .where(inArray(notes.id, byType.note))
      .all()
    for (const r of rows)
      result.set(r.id, { type: 'note', title: r.title, description: r.description ?? null })
  }
  if (byType.csv.length > 0) {
    const rows = db
      .select({ id: csvFiles.id, title: csvFiles.title, description: csvFiles.description })
      .from(csvFiles)
      .where(inArray(csvFiles.id, byType.csv))
      .all()
    for (const r of rows)
      result.set(r.id, { type: 'csv', title: r.title, description: r.description ?? null })
  }
  if (byType.pdf.length > 0) {
    const rows = db
      .select({ id: pdfFiles.id, title: pdfFiles.title, description: pdfFiles.description })
      .from(pdfFiles)
      .where(inArray(pdfFiles.id, byType.pdf))
      .all()
    for (const r of rows)
      result.set(r.id, { type: 'pdf', title: r.title, description: r.description ?? null })
  }
  if (byType.image.length > 0) {
    const rows = db
      .select({ id: imageFiles.id, title: imageFiles.title, description: imageFiles.description })
      .from(imageFiles)
      .where(inArray(imageFiles.id, byType.image))
      .all()
    for (const r of rows)
      result.set(r.id, { type: 'image', title: r.title, description: r.description ?? null })
  }
  if (byType.canvas.length > 0) {
    const rows = db
      .select({ id: canvases.id, title: canvases.title, description: canvases.description })
      .from(canvases)
      .where(inArray(canvases.id, byType.canvas))
      .all()
    for (const r of rows)
      result.set(r.id, { type: 'canvas', title: r.title, description: r.description ?? null })
  }

  return result
}

const ALLOWED_LINK_TYPES = new Set<HistoryLinkType>(['note', 'csv', 'pdf', 'image', 'canvas'])

function isAllowedLinkType(t: string): t is HistoryLinkType {
  return ALLOWED_LINK_TYPES.has(t as HistoryLinkType)
}

export const historyService = {
  fetch(workspaceId: string, options: HistoryFetchOptions = {}): HistoryFetchResult {
    const dayOffset = Math.max(0, options.dayOffset ?? 0)
    const dayLimit = Math.max(1, options.dayLimit ?? 10)
    const query = options.query?.trim().toLowerCase() ?? ''

    // 1. 완료된 todos 조회 (날짜 필터 포함)
    const conditions = [
      eq(todos.workspaceId, workspaceId),
      eq(todos.isDone, true),
      isNotNull(todos.doneAt)
    ]
    if (options.fromDate) {
      conditions.push(gte(todos.doneAt!, dateKeyToStartOfDay(options.fromDate)))
    }
    if (options.toDate) {
      conditions.push(lte(todos.doneAt!, dateKeyToEndOfDay(options.toDate)))
    }
    const todoRows = db
      .select({ id: todos.id, title: todos.title, doneAt: todos.doneAt })
      .from(todos)
      .where(and(...conditions))
      .all()

    if (todoRows.length === 0) {
      return { days: [], hasMore: false, nextDayOffset: dayOffset }
    }

    // 2. todo별 링크 fetch (한 번에 OR로)
    const todoIds = todoRows.map((t) => t.id)
    const linkRows = db
      .select()
      .from(entityLinks)
      .where(
        and(
          eq(entityLinks.workspaceId, workspaceId),
          or(
            and(eq(entityLinks.sourceType, 'todo'), inArray(entityLinks.sourceId, todoIds)),
            and(eq(entityLinks.targetType, 'todo'), inArray(entityLinks.targetId, todoIds))
          )
        )
      )
      .all()

    // 3. todo → 링크 entity 목록 (todo 시점에서 반대편이 어떤 type/id인지)
    const todoToLinkRefs = new Map<string, { type: HistoryLinkType; id: string }[]>()
    for (const link of linkRows) {
      let todoId: string
      let otherType: string
      let otherId: string
      if (link.sourceType === 'todo' && todoIds.includes(link.sourceId)) {
        todoId = link.sourceId
        otherType = link.targetType
        otherId = link.targetId
      } else if (link.targetType === 'todo' && todoIds.includes(link.targetId)) {
        todoId = link.targetId
        otherType = link.sourceType
        otherId = link.sourceId
      } else {
        continue
      }
      if (!isAllowedLinkType(otherType)) continue
      const arr = todoToLinkRefs.get(todoId) ?? []
      arr.push({ type: otherType, id: otherId })
      todoToLinkRefs.set(todoId, arr)
    }

    // 4. 링크 entity 제목 일괄 fetch
    const allRefs: { type: HistoryLinkType; id: string }[] = []
    for (const refs of todoToLinkRefs.values()) {
      allRefs.push(...refs)
    }
    const titleMap = fetchLinkMeta(allRefs)

    // 5. todo entry 조립
    const todoEntries: HistoryTodoEntry[] = todoRows
      .filter((t) => t.doneAt != null)
      .map((t) => {
        const refs = todoToLinkRefs.get(t.id) ?? []
        const links: HistoryLink[] = []
        for (const ref of refs) {
          const meta = titleMap.get(ref.id)
          if (meta) {
            links.push({
              type: meta.type,
              id: ref.id,
              title: meta.title,
              description: meta.description
            })
          }
        }
        return {
          id: t.id,
          title: t.title,
          doneAt: t.doneAt!,
          links,
          kind: 'todo' as const
        }
      })

    // 5-2. 반복 할일 완료 fetch (entityLinks 미지원 → links 빈 배열)
    const recurringConditions = [eq(recurringCompletions.workspaceId, workspaceId)]
    if (options.fromDate) {
      recurringConditions.push(
        gte(recurringCompletions.completedAt, dateKeyToStartOfDay(options.fromDate))
      )
    }
    if (options.toDate) {
      recurringConditions.push(
        lte(recurringCompletions.completedAt, dateKeyToEndOfDay(options.toDate))
      )
    }
    const recurringRows = db
      .select({
        id: recurringCompletions.id,
        title: recurringCompletions.ruleTitle,
        completedAt: recurringCompletions.completedAt
      })
      .from(recurringCompletions)
      .where(and(...recurringConditions))
      .all()

    const recurringEntries: HistoryTodoEntry[] = recurringRows.map((r) => ({
      // todo id와 충돌 방지를 위한 prefix
      id: `recurring:${r.id}`,
      title: r.title,
      doneAt: r.completedAt,
      links: [],
      kind: 'recurring' as const
    }))

    const entries: HistoryTodoEntry[] = [...todoEntries, ...recurringEntries]

    // 6. 날짜별 그룹화 (locale date)
    const dayMap = new Map<string, HistoryTodoEntry[]>()
    for (const entry of entries) {
      const key = toLocalDateKey(entry.doneAt)
      const arr = dayMap.get(key) ?? []
      arr.push(entry)
      dayMap.set(key, arr)
    }

    // 7. 텍스트 검색: day 단위 매칭 (todo title OR 링크 file title)
    const matchedKeys = new Set<string>()
    if (query) {
      for (const [key, dayEntries] of dayMap) {
        const hasMatch = dayEntries.some((e) => {
          if (e.title.toLowerCase().includes(query)) return true
          return e.links.some((l) => l.title.toLowerCase().includes(query))
        })
        if (hasMatch) matchedKeys.add(key)
      }
    }

    // 8. day 정렬 (desc), 검색 시 매칭 day만, 페이징 적용
    let sortedKeys = Array.from(dayMap.keys()).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))
    if (query) {
      sortedKeys = sortedKeys.filter((k) => matchedKeys.has(k))
    }

    const totalDays = sortedKeys.length
    const sliced = sortedKeys.slice(dayOffset, dayOffset + dayLimit)
    const hasMore = dayOffset + dayLimit < totalDays
    const nextDayOffset = dayOffset + sliced.length

    // 각 day 내 todo는 doneAt desc
    const days: HistoryDay[] = sliced.map((key) => {
      const dayEntries = (dayMap.get(key) ?? []).slice().sort((a, b) => {
        return b.doneAt.getTime() - a.doneAt.getTime()
      })
      return { date: key, todos: dayEntries }
    })

    return { days, hasMore, nextDayOffset }
  }
}

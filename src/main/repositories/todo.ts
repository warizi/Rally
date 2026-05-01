import { and, count, eq, inArray, isNull, isNotNull, like, or, gte, lte } from 'drizzle-orm'
import { db } from '../db'
import { todos } from '../db/schema'

export type Todo = typeof todos.$inferSelect
export type TodoInsert = typeof todos.$inferInsert

/** 모든 read 쿼리에서 휴지통 항목 제외 — `deleted_at IS NULL` 가드 */
const NOT_DELETED = isNull(todos.deletedAt)

export const todoRepository = {
  /** 풀 fetch 없이 SQL COUNT로 active/completed/total 카운트만 반환 (휴지통 제외) */
  countByWorkspaceId(workspaceId: string): { active: number; completed: number; total: number } {
    const base = and(eq(todos.workspaceId, workspaceId), NOT_DELETED)!
    const totalRow = db.select({ n: count() }).from(todos).where(base).get()
    const completedRow = db
      .select({ n: count() })
      .from(todos)
      .where(and(base, eq(todos.isDone, true)))
      .get()
    const total = totalRow?.n ?? 0
    const completed = completedRow?.n ?? 0
    return { active: total - completed, completed, total }
  },

  findByWorkspaceId(workspaceId: string, filter?: 'all' | 'active' | 'completed'): Todo[] {
    const base = and(eq(todos.workspaceId, workspaceId), NOT_DELETED)!
    if (filter === 'active') {
      // 최상위 미완료 + 모든 sub-todo (isDone 무관)
      return db
        .select()
        .from(todos)
        .where(
          and(
            base,
            or(and(isNull(todos.parentId), eq(todos.isDone, false)), isNotNull(todos.parentId))
          )
        )
        .all()
    }
    if (filter === 'completed') {
      // 최상위 완료 투두만
      return db
        .select()
        .from(todos)
        .where(and(base, isNull(todos.parentId), eq(todos.isDone, true)))
        .all()
    }
    return db.select().from(todos).where(base).all()
  },

  findByWorkspaceIdAndDateRange(workspaceId: string, start: Date, end: Date): Todo[] {
    const base = and(eq(todos.workspaceId, workspaceId), NOT_DELETED)!
    // startDate 또는 dueDate가 범위 내에 있는 todo
    return db
      .select()
      .from(todos)
      .where(
        and(
          base,
          isNull(todos.parentId),
          or(
            and(isNotNull(todos.startDate), lte(todos.startDate, end), gte(todos.startDate, start)),
            and(isNotNull(todos.dueDate), lte(todos.dueDate, end), gte(todos.dueDate, start)),
            and(
              isNotNull(todos.startDate),
              isNotNull(todos.dueDate),
              lte(todos.startDate, end),
              gte(todos.dueDate, start)
            )
          )
        )
      )
      .all()
  },

  /** 활성 row만 반환 (휴지통 제외). trashService는 findByIdIncludingDeleted 사용. */
  findById(id: string): Todo | undefined {
    return db
      .select()
      .from(todos)
      .where(and(eq(todos.id, id), NOT_DELETED))
      .get()
  },

  /** 휴지통 포함 — trashService에서 복구·purge 시 사용 */
  findByIdIncludingDeleted(id: string): Todo | undefined {
    return db.select().from(todos).where(eq(todos.id, id)).get()
  },

  findByParentId(parentId: string): Todo[] {
    return db
      .select()
      .from(todos)
      .where(and(eq(todos.parentId, parentId), NOT_DELETED))
      .all()
  },

  /**
   * 동적 필터 검색. AND 조합. 휴지통 제외.
   * - filter: 'active'면 (top-level 미완료 OR 모든 sub-todo), 'completed'면 top-level 완료만, 그 외 전부
   * - parentId: undefined=무관, null=top-level only, string=해당 parent의 자식만
   * - dueWithin: { from, to } 범위에 dueDate가 들어가는 것만
   * - priority: 주어진 priority들 중 하나
   * - search: title LIKE %s%
   * - includeIds: 추가로 ID 화이트리스트 (linkedTo 필터용 — 서비스 레이어에서 reverse lookup 후 ID 리스트 전달)
   */
  findByWorkspaceWithFilters(
    workspaceId: string,
    options: {
      filter?: 'all' | 'active' | 'completed'
      parentId?: string | null
      dueWithin?: { from: Date; to: Date }
      priority?: ('high' | 'medium' | 'low')[]
      search?: string
      includeIds?: string[]
    }
  ): Todo[] {
    const conditions = [eq(todos.workspaceId, workspaceId), NOT_DELETED]

    if (options.filter === 'active') {
      conditions.push(
        or(and(isNull(todos.parentId), eq(todos.isDone, false)), isNotNull(todos.parentId))!
      )
    } else if (options.filter === 'completed') {
      conditions.push(isNull(todos.parentId))
      conditions.push(eq(todos.isDone, true))
    }

    if (options.parentId === null) {
      conditions.push(isNull(todos.parentId))
    } else if (typeof options.parentId === 'string') {
      conditions.push(eq(todos.parentId, options.parentId))
    }

    if (options.dueWithin) {
      conditions.push(
        and(
          isNotNull(todos.dueDate),
          gte(todos.dueDate, options.dueWithin.from),
          lte(todos.dueDate, options.dueWithin.to)
        )!
      )
    }

    if (options.priority && options.priority.length > 0) {
      conditions.push(inArray(todos.priority, options.priority))
    }

    if (options.search && options.search.trim()) {
      conditions.push(like(todos.title, `%${options.search.trim()}%`))
    }

    if (options.includeIds) {
      if (options.includeIds.length === 0) return []
      conditions.push(inArray(todos.id, options.includeIds))
    }

    return db
      .select()
      .from(todos)
      .where(and(...conditions))
      .all()
  },

  findTopLevelByWorkspaceId(workspaceId: string): Todo[] {
    return db
      .select()
      .from(todos)
      .where(and(eq(todos.workspaceId, workspaceId), isNull(todos.parentId), NOT_DELETED))
      .all()
  },

  create(data: TodoInsert): Todo {
    return db.insert(todos).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<
      Pick<
        Todo,
        | 'title'
        | 'description'
        | 'status'
        | 'priority'
        | 'isDone'
        | 'listOrder'
        | 'kanbanOrder'
        | 'subOrder'
        | 'doneAt'
        | 'dueDate'
        | 'startDate'
        | 'updatedAt'
        | 'deletedAt'
        | 'trashBatchId'
      >
    >
  ): Todo | undefined {
    return db.update(todos).set(data).where(eq(todos.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(todos).where(eq(todos.id, id)).run()
  },

  bulkUpdateListOrder(updates: { id: string; order: number }[]): void {
    if (updates.length === 0) return
    const now = Date.now()
    const stmt = db.$client.prepare(`UPDATE todos SET list_order = ?, updated_at = ? WHERE id = ?`)
    db.$client.transaction(() => {
      for (const u of updates) {
        stmt.run(u.order, now, u.id)
      }
    })()
  },

  bulkUpdateKanbanOrder(
    updates: {
      id: string
      order: number
      status?: string
      isDone?: boolean
      doneAt?: number | null
    }[]
  ): void {
    if (updates.length === 0) return
    const now = Date.now()
    db.$client.transaction(() => {
      for (const u of updates) {
        if (u.status !== undefined) {
          db.$client
            .prepare(
              `UPDATE todos SET kanban_order = ?, status = ?, is_done = ?, done_at = ?, updated_at = ? WHERE id = ?`
            )
            .run(u.order, u.status, u.isDone ? 1 : 0, u.doneAt ?? null, now, u.id)
        } else {
          db.$client
            .prepare(`UPDATE todos SET kanban_order = ?, updated_at = ? WHERE id = ?`)
            .run(u.order, now, u.id)
        }
      }
    })()
  },

  /** 모든 후손 ID 반환. trashService cascade 처리에서 휴지통 row까지 포함하기 위해 raw 쿼리 사용. */
  findAllDescendantIds(parentId: string, options: { includeDeleted?: boolean } = {}): string[] {
    const result: string[] = []
    const queue = [parentId]

    while (queue.length > 0) {
      const currentId = queue.shift()!
      const where = options.includeDeleted
        ? eq(todos.parentId, currentId)
        : and(eq(todos.parentId, currentId), NOT_DELETED)
      const children = db.select({ id: todos.id }).from(todos).where(where).all()
      for (const child of children) {
        result.push(child.id)
        queue.push(child.id)
      }
    }

    return result
  },

  findByIds(ids: string[]): Todo[] {
    if (ids.length === 0) return []
    const CHUNK = 900
    const results: Todo[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      results.push(
        ...db
          .select()
          .from(todos)
          .where(and(inArray(todos.id, chunk), NOT_DELETED))
          .all()
      )
    }
    return results
  },

  /** 제목/설명 LIKE 검색 — 검색 도구용 */
  searchByTitleOrDescription(workspaceId: string, query: string): Todo[] {
    const pattern = `%${query}%`
    return db
      .select()
      .from(todos)
      .where(
        and(
          eq(todos.workspaceId, workspaceId),
          NOT_DELETED,
          or(like(todos.title, pattern), like(todos.description, pattern))!
        )
      )
      .all()
  },

  /** 휴지통(deleted_at IS NOT NULL) row만 — trashService.list 용 */
  findInTrashByWorkspaceId(workspaceId: string): Todo[] {
    return db
      .select()
      .from(todos)
      .where(and(eq(todos.workspaceId, workspaceId), isNotNull(todos.deletedAt)))
      .all()
  },

  /** trash batch에 묶인 모든 todo (cascade 자식 포함) */
  findByTrashBatchId(batchId: string): Todo[] {
    return db.select().from(todos).where(eq(todos.trashBatchId, batchId)).all()
  },

  bulkUpdateSubOrder(updates: { id: string; order: number }[]): void {
    if (updates.length === 0) return
    const now = Date.now()
    const stmt = db.$client.prepare(`UPDATE todos SET sub_order = ?, updated_at = ? WHERE id = ?`)
    db.$client.transaction(() => {
      for (const u of updates) {
        stmt.run(u.order, now, u.id)
      }
    })()
  }
}

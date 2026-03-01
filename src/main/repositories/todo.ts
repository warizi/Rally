import { and, eq, isNull, isNotNull, or } from 'drizzle-orm'
import { db } from '../db'
import { todos } from '../db/schema'

export type Todo = typeof todos.$inferSelect
export type TodoInsert = typeof todos.$inferInsert

export const todoRepository = {
  findByWorkspaceId(
    workspaceId: string,
    filter?: 'all' | 'active' | 'completed'
  ): Todo[] {
    const base = eq(todos.workspaceId, workspaceId)
    if (filter === 'active') {
      // 최상위 미완료 + 모든 sub-todo (isDone 무관)
      return db
        .select()
        .from(todos)
        .where(and(base, or(and(isNull(todos.parentId), eq(todos.isDone, false)), isNotNull(todos.parentId))))
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

  findById(id: string): Todo | undefined {
    return db.select().from(todos).where(eq(todos.id, id)).get()
  },

  findByParentId(parentId: string): Todo[] {
    return db.select().from(todos).where(eq(todos.parentId, parentId)).all()
  },

  findTopLevelByWorkspaceId(workspaceId: string): Todo[] {
    return db
      .select()
      .from(todos)
      .where(and(eq(todos.workspaceId, workspaceId), isNull(todos.parentId)))
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

  findAllDescendantIds(parentId: string): string[] {
    const result: string[] = []
    const queue = [parentId]

    while (queue.length > 0) {
      const currentId = queue.shift()!
      const children = db
        .select({ id: todos.id })
        .from(todos)
        .where(eq(todos.parentId, currentId))
        .all()
      for (const child of children) {
        result.push(child.id)
        queue.push(child.id)
      }
    }

    return result
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

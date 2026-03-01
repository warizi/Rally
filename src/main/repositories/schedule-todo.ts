import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { scheduleTodos, todos } from '../db/schema'

export type ScheduleTodo = typeof scheduleTodos.$inferSelect

export const scheduleTodoRepository = {
  findTodosByScheduleId(scheduleId: string) {
    return db
      .select({ todo: todos })
      .from(scheduleTodos)
      .innerJoin(todos, eq(scheduleTodos.todoId, todos.id))
      .where(eq(scheduleTodos.scheduleId, scheduleId))
      .all()
      .map((row) => row.todo)
  },

  link(scheduleId: string, todoId: string): void {
    db.insert(scheduleTodos).values({ scheduleId, todoId }).onConflictDoNothing().run()
  },

  unlink(scheduleId: string, todoId: string): void {
    db.delete(scheduleTodos)
      .where(and(eq(scheduleTodos.scheduleId, scheduleId), eq(scheduleTodos.todoId, todoId)))
      .run()
  },
}

import { eq } from 'drizzle-orm'
import { db } from '../db'
import { systemSkillOverrides } from '../db/schema'

export type SystemSkillOverride = typeof systemSkillOverrides.$inferSelect
export type SystemSkillOverrideInsert = typeof systemSkillOverrides.$inferInsert

export const systemSkillOverrideRepository = {
  findByName(name: string): SystemSkillOverride | undefined {
    return db.select().from(systemSkillOverrides).where(eq(systemSkillOverrides.name, name)).get()
  },

  upsert(data: SystemSkillOverrideInsert): SystemSkillOverride {
    const existing = systemSkillOverrideRepository.findByName(data.name)
    if (existing) {
      return db
        .update(systemSkillOverrides)
        .set({
          content: data.content,
          mcpToolsJson: data.mcpToolsJson,
          triggersJson: data.triggersJson,
          updatedAt: data.updatedAt
        })
        .where(eq(systemSkillOverrides.name, data.name))
        .returning()
        .get()
    }
    return db.insert(systemSkillOverrides).values(data).returning().get()
  },

  delete(name: string): void {
    db.delete(systemSkillOverrides).where(eq(systemSkillOverrides.name, name)).run()
  }
}

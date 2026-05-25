import { asc, eq } from 'drizzle-orm'
import { db } from '../db'
import { systemSkills } from '../db/schema'

export type SystemSkill = typeof systemSkills.$inferSelect
export type SystemSkillInsert = typeof systemSkills.$inferInsert
export type SystemSkillUpdate = Partial<Omit<SystemSkillInsert, 'name' | 'createdAt'>>

export const systemSkillRepository = {
  findByName(name: string): SystemSkill | undefined {
    return db.select().from(systemSkills).where(eq(systemSkills.name, name)).get()
  },

  findAll(): SystemSkill[] {
    return db.select().from(systemSkills).orderBy(asc(systemSkills.createdAt)).all()
  },

  insert(data: SystemSkillInsert): SystemSkill {
    return db.insert(systemSkills).values(data).returning().get()
  },

  update(name: string, data: SystemSkillUpdate): SystemSkill | undefined {
    return db.update(systemSkills).set(data).where(eq(systemSkills.name, name)).returning().get()
  },

  /** seed 또는 reset 시 사용 — 존재 여부와 무관하게 정확히 한 row 를 보장. */
  upsert(data: SystemSkillInsert): SystemSkill {
    const existing = systemSkillRepository.findByName(data.name)
    if (existing) {
      return db
        .update(systemSkills)
        .set({
          content: data.content,
          mcpToolsJson: data.mcpToolsJson,
          triggersJson: data.triggersJson,
          updatedAt: data.updatedAt
        })
        .where(eq(systemSkills.name, data.name))
        .returning()
        .get()
    }
    return db.insert(systemSkills).values(data).returning().get()
  },

  delete(name: string): void {
    db.delete(systemSkills).where(eq(systemSkills.name, name)).run()
  }
}

import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { customSkills } from '../db/schema'

export type CustomSkill = typeof customSkills.$inferSelect
export type CustomSkillInsert = typeof customSkills.$inferInsert
export type CustomSkillUpdate = Partial<Omit<CustomSkillInsert, 'id' | 'createdAt'>>

export const customSkillRepository = {
  findAll(): CustomSkill[] {
    return db.select().from(customSkills).orderBy(desc(customSkills.createdAt)).all()
  },

  findById(id: string): CustomSkill | undefined {
    return db.select().from(customSkills).where(eq(customSkills.id, id)).get()
  },

  findByName(name: string): CustomSkill | undefined {
    return db.select().from(customSkills).where(eq(customSkills.name, name)).get()
  },

  create(data: CustomSkillInsert): CustomSkill {
    return db.insert(customSkills).values(data).returning().get()
  },

  update(id: string, data: CustomSkillUpdate): CustomSkill | undefined {
    return db.update(customSkills).set(data).where(eq(customSkills.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(customSkills).where(eq(customSkills.id, id)).run()
  }
}

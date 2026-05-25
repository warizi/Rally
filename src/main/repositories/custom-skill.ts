import { desc, eq, isNull, isNotNull, and } from 'drizzle-orm'
import { db } from '../db'
import { customSkills } from '../db/schema'

export type CustomSkill = typeof customSkills.$inferSelect
export type CustomSkillInsert = typeof customSkills.$inferInsert
export type CustomSkillUpdate = Partial<Omit<CustomSkillInsert, 'id' | 'createdAt'>>

export const customSkillRepository = {
  /** 활성 (휴지통 아님) 만. 일반 목록·검색에 사용. */
  findActive(): CustomSkill[] {
    return db
      .select()
      .from(customSkills)
      .where(isNull(customSkills.deletedAt))
      .orderBy(desc(customSkills.createdAt))
      .all()
  },

  /** 휴지통 (deletedAt notnull) 만. 휴지통 UI 에 사용. */
  findTrashed(): CustomSkill[] {
    return db
      .select()
      .from(customSkills)
      .where(isNotNull(customSkills.deletedAt))
      .orderBy(desc(customSkills.deletedAt))
      .all()
  },

  /** 활성 + 휴지통 모두. 디버깅이나 통계용. */
  findAll(): CustomSkill[] {
    return db.select().from(customSkills).orderBy(desc(customSkills.createdAt)).all()
  },

  findById(id: string): CustomSkill | undefined {
    return db.select().from(customSkills).where(eq(customSkills.id, id)).get()
  },

  /** 이름 중복 검사용 — 활성 항목만 대상 (휴지통 안의 동명이인은 허용). */
  findActiveByName(name: string): CustomSkill | undefined {
    return db
      .select()
      .from(customSkills)
      .where(and(eq(customSkills.name, name), isNull(customSkills.deletedAt)))
      .get()
  },

  create(data: CustomSkillInsert): CustomSkill {
    return db.insert(customSkills).values(data).returning().get()
  },

  update(id: string, data: CustomSkillUpdate): CustomSkill | undefined {
    return db.update(customSkills).set(data).where(eq(customSkills.id, id)).returning().get()
  },

  /** 영구 삭제 — 휴지통 비우기 시에만 호출. */
  delete(id: string): void {
    db.delete(customSkills).where(eq(customSkills.id, id)).run()
  }
}

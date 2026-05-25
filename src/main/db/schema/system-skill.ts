import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * 기본 (system) skill 의 canonical 저장소.
 *
 * 이전에는 `.claude/skills/<name>/SKILL.md` 파일이 source of truth 였고
 * 이 테이블은 사용자 override 만 보관했지만, 이제는 default 자체가 코드 상수
 * (`system-skills-seed.ts`) 이고 이 테이블이 런타임 단일 진실 공급원이 된다.
 *
 * 첫 부팅 시 seed 상수에서 row 가 자동 insert. 사용자가 수정하면 row 가 갱신,
 * "기본값으로 복원" 액션은 seed 값으로 다시 덮어쓴다.
 */
export const systemSkills = sqliteTable('system_skills', {
  name: text('name').primaryKey(),
  content: text('content').notNull(),
  mcpToolsJson: text('mcp_tools_json').notNull().default('[]'),
  triggersJson: text('triggers_json').notNull().default('[]'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})

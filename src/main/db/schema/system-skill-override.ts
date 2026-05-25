import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * System skill (`rally`, `rally-plan`, `rally-do` 등) 에 대한 사용자 override.
 *
 * 번들된 `.claude/skills/<name>/SKILL.md` 파일은 read-only 로 두고,
 * 사용자가 system skill 을 수정하면 이 테이블에 row 가 upsert 된다.
 * 로드 시 override 가 있으면 그것을 우선 사용, 없으면 번들 파일에서 fallback.
 *
 * "기본값으로 리셋" 액션은 이 row 를 삭제한다.
 */
export const systemSkillOverrides = sqliteTable('system_skill_overrides', {
  name: text('name').primaryKey(),
  content: text('content').notNull(),
  mcpToolsJson: text('mcp_tools_json').notNull().default('[]'),
  triggersJson: text('triggers_json').notNull().default('[]'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})

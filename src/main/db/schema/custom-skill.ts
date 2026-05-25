import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * 사용자가 등록한 커스텀 Claude skill. 전역 (workspace 무관).
 *
 * - 기본(system) skill 은 코드 상수로 정의되며 이 테이블에 저장되지 않는다.
 * - `name` 은 `~/.claude/skills/<name>/SKILL.md` 파일 경로의 디렉터리명이 되므로
 *   파일시스템에 안전한 식별자여야 한다 (service 계층에서 검증).
 * - `mcpToolsJson` / `triggersJson` 은 string[] 을 JSON 문자열로 직렬화.
 * - `content` 는 SKILL.md frontmatter + 본문 전체.
 */
export const customSkills = sqliteTable('custom_skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  content: text('content').notNull(),
  mcpToolsJson: text('mcp_tools_json').notNull().default('[]'),
  triggersJson: text('triggers_json').notNull().default('[]'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * 노트 마크다운 스타일 템플릿. 전역 (workspace 무관).
 *
 * - `settingsJson` 는 NoteStyleSettings (light/dark) 전체를 JSON 문자열로 저장.
 * - 적용 시 사용자가 `noteStyle` app-setting 키에 settingsJson 을 그대로 set.
 */
export const noteStyleTemplates = sqliteTable('note_style_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  settingsJson: text('settings_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
})

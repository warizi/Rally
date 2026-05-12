import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { beforeEach, vi } from 'vitest'
import * as schema from '../db/schema'

const sqlite = new Database(':memory:')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const testDb = drizzle(sqlite, { schema })

migrate(testDb, { migrationsFolder: './src/main/db/migrations' })

vi.mock('../db', () => ({
  db: testDb
}))

// 새 테이블 추가 시 반드시 이 배열에 추가. scripts/check-cleanup-completeness.mjs 가 누락을 CI에서 차단.
// 정리 중에는 FK를 일시적으로 끄므로 순서 자체로 인한 위반은 발생하지 않지만,
// 명시적 등록을 통해 "이 테이블도 cleanup 대상"이라는 사실을 코드로 남긴다.
const TABLES = [
  'itemTags',
  'entityLinks',
  'reminders',
  'tabSnapshots',
  'tabSessions',
  'terminalSessions',
  'terminalLayouts',
  'canvasEdges',
  'canvasNodes',
  'canvasGroups',
  'canvases',
  'recurringCompletions',
  'recurringRules',
  'scheduleTodos',
  'schedules',
  'todos',
  'csvFiles',
  'pdfFiles',
  'imageFiles',
  'notes',
  'tags',
  'templates',
  'folders',
  'trashBatches',
  'workspaces',
  'appSettings'
] as const

export function resetAllTables(): void {
  // FK 일시 비활성 → 순서 무관하게 모든 행 삭제 → 재활성.
  // trash_batch_id 같은 양방향 참조가 있어 순서 기반 삭제는 깨지기 쉽다.
  sqlite.pragma('foreign_keys = OFF')
  try {
    for (const name of TABLES) {
      const table = (schema as unknown as Record<string, unknown>)[name]
      if (table) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        testDb.delete(table as any).run()
      }
    }
  } finally {
    sqlite.pragma('foreign_keys = ON')
  }
}

beforeEach(() => {
  resetAllTables()
})

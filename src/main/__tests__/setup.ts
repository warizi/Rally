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

beforeEach(() => {
  testDb.delete(schema.tabSessions).run()
  testDb.delete(schema.workspaces).run()
})

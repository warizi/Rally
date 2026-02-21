import { app } from 'electron'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import path from 'path'
import * as schema from './schema'

const isDev = !app.isPackaged

const dbPath = isDev
  ? path.join(process.cwd(), 'rally-dev.db')
  : path.join(app.getPath('userData'), 'rally.db')

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

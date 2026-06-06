import { app } from 'electron'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import path from 'path'
import * as schema from './schema'

const isDev = !app.isPackaged

const dbPath = isDev
  ? path.join(process.cwd(), 'rally-dev.db')
  : path.join(app.getPath('userData'), 'rally.db')

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

// sqlite-vec 로드 — 실패해도 앱은 정상 동작(시맨틱 검색만 비활성).
// ABI/플랫폼 이슈로 로드가 깨져도 기존 키워드 검색으로 graceful degradation.
let vecEnabledFlag = false
try {
  sqliteVec.load(sqlite)
  vecEnabledFlag = true
} catch (e) {
  console.warn('[db] sqlite-vec load failed — semantic search disabled', e)
}

/** sqlite-vec 확장이 로드됐는지 여부. 검색/임베딩 경로 분기에 사용. */
export const vecEnabled = vecEnabledFlag

/** vec0 가상 테이블 등 raw SQL 접근용 better-sqlite3 핸들. */
export const rawSqlite = sqlite

export const db = drizzle(sqlite, { schema })

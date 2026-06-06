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
//
// ⚠️ 패키지(prod) 빌드: sqlite-vec.getLoadablePath() 는 require.resolve 로 .dylib/.so/.dll
// 경로를 잡는데 패키지 앱에선 이 경로가 app.asar 내부로 나온다. 네이티브 dlopen 은 asar
// 가상경로를 못 열어 로드 실패 → vec 비활성. asarUnpack 으로 실제 파일은 app.asar.unpacked
// 에 풀려 있으므로 경로를 그쪽으로 보정해야 한다. (dev 는 'app.asar' 문자열이 없어 no-op)
let vecEnabledFlag = false
try {
  const loadablePath = sqliteVec.getLoadablePath().replace('app.asar', 'app.asar.unpacked')
  sqlite.loadExtension(loadablePath)
  vecEnabledFlag = true
} catch (e) {
  // 부팅 초기(logger 준비 전)라 console 사용. 로드 실패는 치명적이지 않음.
  // eslint-disable-next-line no-console
  console.warn('[db] sqlite-vec load failed — semantic search disabled', e)
}

/** sqlite-vec 확장이 로드됐는지 여부. 검색/임베딩 경로 분기에 사용. */
export const vecEnabled = vecEnabledFlag

/** vec0 가상 테이블 등 raw SQL 접근용 better-sqlite3 핸들. */
export const rawSqlite = sqlite

export const db = drizzle(sqlite, { schema })

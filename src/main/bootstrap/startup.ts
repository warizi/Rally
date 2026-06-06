import { app } from 'electron'
import { dirname, join } from 'path'
import { existsSync, mkdirSync, renameSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { scoped } from '../lib/logger'
import { db, rawSqlite, vecEnabled } from '../db'
import { EMBEDDING_DIM } from '../services/embedding-config'
import { workspaceService } from '../services/workspace'
import { ensureClaudeCommands } from '../services/claude-commands-setup'
import { seedSystemSkills } from '../services/skill'

function runMigrations(): void {
  const migrationsFolder = is.dev
    ? join(process.cwd(), 'src/main/db/migrations')
    : join(process.resourcesPath, 'migrations')
  migrate(db, { migrationsFolder })
}

/**
 * 검색용 가상 테이블 생성 (vec0 + FTS5). drizzle이 가상 테이블 모듈을 모르므로 런타임 처리.
 * vecEnabled=false(확장 로드 실패)면 vec0는 건너뛰어 부팅이 깨지지 않는다.
 * FTS5는 SQLite 내장이라 vec와 무관하게 생성하지만, 인덱스 동기화는 임베딩 훅과 함께 동작한다.
 */
function ensureSearchTables(): void {
  // FTS5 (키워드/BM25). trigram 토크나이저로 한국어 부분 매칭 지원.
  try {
    rawSqlite.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
         text,
         entity_type UNINDEXED,
         entity_id UNINDEXED,
         tokenize='trigram'
       )`
    )
  } catch (e) {
    scoped('search').warn('FTS5 search_fts creation failed', e)
  }

  if (!vecEnabled) {
    scoped('vec').warn('sqlite-vec disabled — skipping vec table creation')
    return
  }
  rawSqlite.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(embedding float[${EMBEDDING_DIM}])`
  )
}

function initializeDatabase(): void {
  const workspaces = workspaceService.getAll()
  if (workspaces.length === 0) {
    const defaultPath = join(app.getPath('home'), 'Rally', '기본 워크스페이스')
    workspaceService.create('기본 워크스페이스', defaultPath)
  }
}

function ensureAllWorkspaceCommands(): void {
  const workspaces = workspaceService.getAll()
  for (const ws of workspaces) {
    ensureClaudeCommands(ws.path)
  }
}

// macOS TCC가 ~/Documents를 보호하면서 발생하던 EPERM을 해결하기 위해
// 기본 워크스페이스 위치를 ~/Documents/Rally → ~/Rally로 이동시킨다.
// 사용자가 직접 설정한 경로는 건드리지 않고, 정확히 옛 기본 경로를 쓰는 워크스페이스만 대상.
function migrateLegacyDefaultWorkspacePath(): void {
  const log = scoped('migrate-default-path')
  const legacyPath = join(app.getPath('documents'), 'Rally', '기본 워크스페이스')
  const newPath = join(app.getPath('home'), 'Rally', '기본 워크스페이스')
  if (legacyPath === newPath) return

  const all = workspaceService.getAll()
  const target = all.find((ws) => ws.path === legacyPath)
  if (!target) return

  if (all.some((ws) => ws.id !== target.id && ws.path === newPath)) {
    log.warn(`another workspace already uses ${newPath}; skipping migration`)
    return
  }

  try {
    mkdirSync(dirname(newPath), { recursive: true })
  } catch (err) {
    log.warn(`cannot create parent dir for ${newPath}:`, err)
    return
  }

  if (!existsSync(newPath)) {
    let moved = false
    try {
      renameSync(legacyPath, newPath)
      moved = true
      log.info(`moved ${legacyPath} → ${newPath}`)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      log.warn(
        `cannot move legacy dir (${code}); creating fresh dir. ` +
          `Existing data (if any) remains at ${legacyPath}.`
      )
    }

    if (!moved) {
      try {
        mkdirSync(newPath, { recursive: true })
      } catch (err) {
        log.warn(`cannot create ${newPath}:`, err)
        return
      }
    }
  }

  try {
    workspaceService.update(target.id, { path: newPath })
    log.info(`updated workspace ${target.id} path: ${legacyPath} → ${newPath}`)
  } catch (err) {
    log.warn(`failed to update workspace path in DB:`, err)
  }
}

/**
 * 앱 시작 시 1회 실행되는 DB/워크스페이스 초기화 시퀀스 (순서 유지).
 * 1) 마이그레이션 → 2) 검색 가상 테이블(vec0+FTS5) 보장 → 3) 기본 워크스페이스 보장 →
 * 4) 시스템 skill seed → 5) legacy 기본 경로 이전 → 6) 워크스페이스별 claude 커맨드 보장.
 */
export function runStartup(): void {
  runMigrations()
  ensureSearchTables()
  initializeDatabase()
  seedSystemSkills()
  migrateLegacyDefaultWorkspacePath()
  ensureAllWorkspaceCommands()
}

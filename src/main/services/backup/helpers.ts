import fs from 'fs'
import path from 'path'
import { db } from '../../db'

/**
 * 백업 시스템 공통 헬퍼.
 *
 * 책임:
 *   - JSON 직렬화/역직렬화 (Date ↔ epoch ms)
 *   - 부모-자식 관계 entity 의 위상정렬 (todos 같은 self-FK 보존)
 *   - 디렉토리 재귀 복사 (워크스페이스 데이터 폴더 export)
 *   - 청크 단위 batch insert (SQLite 99 변수 제한 우회)
 */

// ─── 직렬화 ────────────────────────────────────────────────

/** Drizzle timestamp_ms → number (Date → getTime). JSON.stringify replacer 활용. */
export function serializeForExport(data: unknown): unknown {
  return JSON.parse(
    JSON.stringify(data, (_, value) => (value instanceof Date ? value.getTime() : value))
  )
}

/** number → Date (Drizzle insert 용) */
export function toDate(ms: number): Date {
  return new Date(ms)
}

/** nullable timestamp */
export function toDateOrNull(ms: number | null): Date | null {
  return ms != null ? new Date(ms) : null
}

// ─── topological sort ────────────────────────────────────

/**
 * 부모-자식 self-FK 가 있는 entity (예: todos) 의 위상정렬.
 * 부모가 먼저 insert 되도록 정렬하여 FK 제약 위반 방지.
 */
export function sortTodosByParent<T extends { id: string; parentId: string | null }>(
  items: T[]
): T[] {
  const sorted: T[] = []
  const remaining = [...items]
  const inserted = new Set<string>()

  while (remaining.length > 0) {
    const batch = remaining.filter((t) => t.parentId === null || inserted.has(t.parentId))
    if (batch.length === 0) break // 순환 참조 방지
    for (const t of batch) {
      inserted.add(t.id)
      sorted.push(t)
    }
    remaining.splice(0, remaining.length, ...remaining.filter((t) => !inserted.has(t.id)))
  }
  return sorted
}

// ─── FS ─────────────────────────────────────────────────

/** 디렉토리 재귀 복사 (워크스페이스 → backup staging) */
export function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// ─── batch insert ───────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 청크 단위 batch insert.
 *
 * SQLite 의 SQLITE_MAX_VARIABLE_NUMBER (기본 999) 제약 우회 — 99 row 씩
 * 분할 insert. onConflictDoNothing 으로 ID 충돌 (재실행) 안전.
 *
 * `any` 사용은 Drizzle table 의 동적 타입 매칭 한계 — Phase 3 에서
 * 제네릭 + zod 도입 시 함께 제거 예정.
 */
export function batchInsert(table: any, items: any[]): void {
  if (items.length === 0) return
  const CHUNK = 99
  for (let i = 0; i < items.length; i += CHUNK) {
    db.insert(table)
      .values(items.slice(i, i + CHUNK))
      .onConflictDoNothing()
      .run()
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

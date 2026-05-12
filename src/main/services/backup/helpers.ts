import fs from 'fs'
import path from 'path'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
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

/**
 * Date 인스턴스 모두를 epoch ms (number) 로 사전 변환.
 *
 * JSON.stringify 의 replacer 는 Date.toJSON() 결과 (ISO string) 를 받게 되어
 * `value instanceof Date` 매칭이 안 됨 → 명시적 재귀 변환으로 실제 number 직렬화.
 */
function dateToNumber(obj: unknown): unknown {
  if (obj instanceof Date) return obj.getTime()
  if (Array.isArray(obj)) return obj.map(dateToNumber)
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = dateToNumber(v)
    }
    return result
  }
  return obj
}

/** Drizzle timestamp_ms (Date) → number ms. JSON 직렬화 후에도 number 로 보존. */
export function serializeForExport(data: unknown): unknown {
  return dateToNumber(data)
}

/**
 * number 또는 ISO string → Date (Drizzle insert 용).
 * 구버전 백업의 ISO string 도 자연스럽게 처리.
 */
export function toDate(value: number | string): Date {
  return new Date(value)
}

/** nullable timestamp */
export function toDateOrNull(value: number | string | null): Date | null {
  return value != null ? new Date(value) : null
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

/**
 * 청크 단위 batch insert.
 *
 * SQLite 의 SQLITE_MAX_VARIABLE_NUMBER (기본 999) 제약 우회 — 99 row 씩
 * 분할 insert. onConflictDoNothing 으로 ID 충돌 (재실행) 안전.
 *
 * 타입: SQLiteTable + object[] 로 any 제거. Drizzle 의 동적 row 타입과 호출 측의
 * zod-derived 타입 간 변환은 caller 책임 (deserializer 에서 명시).
 */
export function batchInsert(table: SQLiteTable, items: object[]): void {
  if (items.length === 0) return
  const CHUNK = 99
  for (let i = 0; i < items.length; i += CHUNK) {
    db.insert(table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .values(items.slice(i, i + CHUNK) as any)
      .onConflictDoNothing()
      .run()
  }
}

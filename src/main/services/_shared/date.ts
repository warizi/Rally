/**
 * Drizzle timestamp 필드는 `Date | number` 로 노출되므로 (mode 'timestamp_ms' 가
 * 일관적으로 적용되지 않은 과거 흔적) 서비스 레이어에서 Date 로 정규화한다.
 *
 * - `toDate` — NOT NULL 컬럼 (createdAt, updatedAt 등)
 * - `toNullableDate` — nullable 컬럼 (doneAt, dueDate, startDate 등)
 */

export function toDate(x: Date | number): Date {
  return x instanceof Date ? x : new Date(x)
}

export function toNullableDate(x: Date | number | null | undefined): Date | null {
  if (x === null || x === undefined) return null
  return toDate(x)
}

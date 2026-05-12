/**
 * 두 워크스페이스의 entity 데이터가 의미적으로 동등한지 검증.
 * - id 및 FK 컬럼은 export/import 과정에서 재발급되므로 비교에서 제외
 * - timestamp(createdAt/updatedAt)는 원본 보존되므로 비교 포함
 * - sort 후 deep equal (DB 순서 비결정성 회피)
 */
import { eq } from 'drizzle-orm'
import { expect } from 'vitest'
import { testDb } from '../../../__tests__/setup'
import * as schema from '../../../db/schema'

const EXCLUDED_KEYS = new Set([
  'id',
  'workspaceId',
  'folderId',
  'parentId',
  'canvasId',
  'fromNode',
  'toNode',
  'scheduleId',
  'todoId',
  'tagId',
  'ruleId',
  'trashBatchId',
  'entityId'
])

function omit<T extends Record<string, unknown>>(row: T): Partial<T> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (!EXCLUDED_KEYS.has(k)) result[k] = v
  }
  return result as Partial<T>
}

function sortByContent<T>(rows: T[]): T[] {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

/**
 * 워크스페이스에 속한 entity 별로 ID·FK 제외 후 정렬 → deep equal.
 * 호출 측은 expect 실패 시 entity 이름이 메시지에 포함된다.
 */
export function expectWorkspacesEquivalent(idA: string, idB: string): void {
  // workspaceId 직접 FK인 테이블만 검증.
  // canvasNodes / canvasEdges / scheduleTodos / itemTags 등은 부모 FK로 간접 — 부모 비교에 포함됨.
  const tables: Array<{
    name: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fkColumn: any
  }> = [
    { name: 'folders', table: schema.folders, fkColumn: schema.folders.workspaceId },
    { name: 'notes', table: schema.notes, fkColumn: schema.notes.workspaceId },
    { name: 'todos', table: schema.todos, fkColumn: schema.todos.workspaceId },
    { name: 'schedules', table: schema.schedules, fkColumn: schema.schedules.workspaceId },
    { name: 'canvases', table: schema.canvases, fkColumn: schema.canvases.workspaceId }
  ]

  for (const { name, table, fkColumn } of tables) {
    const rowsA = testDb.select().from(table).where(eq(fkColumn, idA)).all() as Record<
      string,
      unknown
    >[]
    const rowsB = testDb.select().from(table).where(eq(fkColumn, idB)).all() as Record<
      string,
      unknown
    >[]

    expect(rowsB.length, `[${name}] row count`).toBe(rowsA.length)
    expect(sortByContent(rowsB.map(omit)), `[${name}] content`).toEqual(
      sortByContent(rowsA.map(omit))
    )
  }

  // 캔버스 자식들은 canvasId 매핑이 1:1 대응됨. 워크스페이스의 모든 캔버스를 합쳐 비교.
  const canvasIdsA = testDb
    .select({ id: schema.canvases.id })
    .from(schema.canvases)
    .where(eq(schema.canvases.workspaceId, idA))
    .all()
    .map((r) => r.id)
  const canvasIdsB = testDb
    .select({ id: schema.canvases.id })
    .from(schema.canvases)
    .where(eq(schema.canvases.workspaceId, idB))
    .all()
    .map((r) => r.id)

  function collect<T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fkCol: any,
    canvasIds: string[]
  ): T[] {
    return canvasIds.flatMap((cid) => testDb.select().from(table).where(eq(fkCol, cid)).all() as T[])
  }

  const nodesA = collect<Record<string, unknown>>(
    schema.canvasNodes,
    schema.canvasNodes.canvasId,
    canvasIdsA
  )
  const nodesB = collect<Record<string, unknown>>(
    schema.canvasNodes,
    schema.canvasNodes.canvasId,
    canvasIdsB
  )
  expect(nodesB.length, '[canvasNodes] row count').toBe(nodesA.length)
  expect(sortByContent(nodesB.map(omit)), '[canvasNodes] content').toEqual(
    sortByContent(nodesA.map(omit))
  )

  const edgesA = collect<Record<string, unknown>>(
    schema.canvasEdges,
    schema.canvasEdges.canvasId,
    canvasIdsA
  )
  const edgesB = collect<Record<string, unknown>>(
    schema.canvasEdges,
    schema.canvasEdges.canvasId,
    canvasIdsB
  )
  expect(edgesB.length, '[canvasEdges] row count').toBe(edgesA.length)
  expect(sortByContent(edgesB.map(omit)), '[canvasEdges] content').toEqual(
    sortByContent(edgesA.map(omit))
  )
}

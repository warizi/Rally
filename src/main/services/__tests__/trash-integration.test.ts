/**
 * P0-1 진입 게이트: trash.ts 통합 매트릭스.
 *
 * 기존 trash-m2/m3-files/m3-folder/sweeper 테스트는 도메인별. 본 파일은 종합:
 *   S1 — todo parent-child cascade
 *   S2 — canvas + nodes + edges cascade
 *   S3 — list → restore 라운드트립
 *   S4 — 다중 batch list 최신순
 *   S5 — sweep: cutoff 경과 batch만 purge
 *
 * fs 작업이 없는 entity(todo, canvas, schedule) 위주로 작성하여
 * 워크스페이스 디렉토리는 빈 디렉토리만 필요.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { eq } from 'drizzle-orm'

import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { trashService } from '../trash'
import { seed } from './lib/seed'

let wsDir: string

beforeEach(() => {
  wsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-trash-it-'))
  fs.mkdirSync(wsDir, { recursive: true })
})

afterEach(() => {
  if (wsDir && fs.existsSync(wsDir)) {
    fs.rmSync(wsDir, { recursive: true, force: true })
  }
})

function activeTodoCount(workspaceId: string): number {
  return testDb
    .select()
    .from(schema.todos)
    .where(eq(schema.todos.workspaceId, workspaceId))
    .all()
    .filter((t) => t.deletedAt === null).length
}

function trashedTodoCount(workspaceId: string): number {
  return testDb
    .select()
    .from(schema.todos)
    .where(eq(schema.todos.workspaceId, workspaceId))
    .all()
    .filter((t) => t.deletedAt !== null).length
}

describe('trash integration matrix', () => {
  // ──────────────────────────────────────────────
  // S1: todo parent → child cascade (DB cascade)
  // ──────────────────────────────────────────────
  it('S1 — softRemove(parent todo) cascades children into same batch', () => {
    const ws = seed.workspace({ path: wsDir })
    const parent = seed.todo(ws.id, { title: 'Parent' })
    const child1 = seed.todo(ws.id, { parentId: parent.id, title: 'Child 1' })
    const child2 = seed.todo(ws.id, { parentId: parent.id, title: 'Child 2' })

    expect(activeTodoCount(ws.id)).toBe(3)

    const batchId = trashService.softRemove(ws.id, 'todo', parent.id)
    expect(batchId).toBeTruthy()

    // 부모 + 자식 2개 모두 같은 batchId 로 trashed
    const trashed = testDb
      .select()
      .from(schema.todos)
      .where(eq(schema.todos.workspaceId, ws.id))
      .all()
    expect(trashed.length).toBe(3)
    expect(trashed.every((t) => t.trashBatchId === batchId)).toBe(true)
    expect(trashed.every((t) => t.deletedAt !== null)).toBe(true)

    expect(activeTodoCount(ws.id)).toBe(0)
    expect(trashedTodoCount(ws.id)).toBe(3)

    // batch row가 child1+child2 = 2 자식 카운트
    const batch = testDb
      .select()
      .from(schema.trashBatches)
      .where(eq(schema.trashBatches.id, batchId))
      .get()
    expect(batch).toBeTruthy()
    expect(batch!.childCount).toBe(2)
    expect(batch!.rootEntityType).toBe('todo')
    expect(batch!.rootEntityId).toBe(parent.id)

    // child 단독 변수 사용 (참조 lint 회피)
    expect(child1.parentId).toBe(parent.id)
    expect(child2.parentId).toBe(parent.id)
  })

  // ──────────────────────────────────────────────
  // S2: canvas + nodes + edges cascade
  // ──────────────────────────────────────────────
  it('S2 — softRemove(canvas) cascades nodes and edges', () => {
    const ws = seed.workspace({ path: wsDir })
    const canvas = seed.canvas(ws.id, { title: 'Diagram' })
    const n1 = seed.canvasNode(canvas.id, { type: 'text' })
    const n2 = seed.canvasNode(canvas.id, { type: 'text', x: 300 })
    const e1 = seed.canvasEdge(canvas.id, n1.id, n2.id)

    const batchId = trashService.softRemove(ws.id, 'canvas', canvas.id)

    const canvasRow = testDb
      .select()
      .from(schema.canvases)
      .where(eq(schema.canvases.id, canvas.id))
      .get()
    const nodeRows = testDb
      .select()
      .from(schema.canvasNodes)
      .where(eq(schema.canvasNodes.canvasId, canvas.id))
      .all()
    const edgeRows = testDb
      .select()
      .from(schema.canvasEdges)
      .where(eq(schema.canvasEdges.id, e1.id))
      .all()

    expect(canvasRow?.deletedAt).not.toBeNull()
    expect(canvasRow?.trashBatchId).toBe(batchId)
    expect(nodeRows.length).toBe(2)
    expect(nodeRows.every((n) => n.deletedAt !== null && n.trashBatchId === batchId)).toBe(true)
    expect(edgeRows.length).toBe(1)
    expect(edgeRows[0].deletedAt).not.toBeNull()
    expect(edgeRows[0].trashBatchId).toBe(batchId)
  })

  // ──────────────────────────────────────────────
  // S3: list → restore 라운드트립
  // ──────────────────────────────────────────────
  it('S3 — softRemove → list → restore brings entity back to active', () => {
    const ws = seed.workspace({ path: wsDir })
    const sched = seed.schedule(ws.id, { title: 'Standup' })

    const batchId = trashService.softRemove(ws.id, 'schedule', sched.id)

    const listResult = trashService.list(ws.id)
    expect(listResult.total).toBe(1)
    expect(listResult.batches[0].id).toBe(batchId)
    expect(listResult.batches[0].rootEntityType).toBe('schedule')
    expect(listResult.batches[0].rootTitle).toBe('Standup')

    const restoreResult = trashService.restore(batchId)
    expect(restoreResult.restored.length).toBeGreaterThan(0)

    const restored = testDb
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.id, sched.id))
      .get()
    expect(restored?.deletedAt).toBeNull()
    expect(restored?.trashBatchId).toBeNull()

    // batch row 자체는 삭제됨
    const batchAfter = testDb
      .select()
      .from(schema.trashBatches)
      .where(eq(schema.trashBatches.id, batchId))
      .get()
    expect(batchAfter).toBeUndefined()
  })

  // ──────────────────────────────────────────────
  // S4: 다중 batch list — 최신순 정렬
  // ──────────────────────────────────────────────
  it('S4 — list returns all batches ordered by deletedAt desc', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const ws = seed.workspace({ path: wsDir })
      const todo1 = seed.todo(ws.id, { title: 'Old' })
      const todo2 = seed.todo(ws.id, { title: 'Mid' })
      const todo3 = seed.todo(ws.id, { title: 'New' })

      vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
      const b1 = trashService.softRemove(ws.id, 'todo', todo1.id)

      vi.setSystemTime(new Date('2026-01-03T00:00:00Z'))
      const b2 = trashService.softRemove(ws.id, 'todo', todo2.id)

      vi.setSystemTime(new Date('2026-01-04T00:00:00Z'))
      const b3 = trashService.softRemove(ws.id, 'todo', todo3.id)

      const result = trashService.list(ws.id)
      expect(result.total).toBe(3)
      expect(result.batches.map((b) => b.id)).toEqual([b3, b2, b1])
    } finally {
      vi.useRealTimers()
    }
  })

  // ──────────────────────────────────────────────
  // S5: sweep — cutoff 경과 batch만 purge
  // ──────────────────────────────────────────────
  it('S5 — sweep purges only batches older than cutoff, FK-safe', () => {
    vi.useFakeTimers()
    try {
      const ws = seed.workspace({ path: wsDir })
      const todoOld = seed.todo(ws.id, { title: 'Old' })
      const todoFresh = seed.todo(ws.id, { title: 'Fresh' })

      // 30일 전 삭제
      vi.setSystemTime(new Date('2026-04-01T00:00:00Z'))
      trashService.softRemove(ws.id, 'todo', todoOld.id)

      // 오늘 삭제
      vi.setSystemTime(new Date('2026-05-01T00:00:00Z'))
      trashService.softRemove(ws.id, 'todo', todoFresh.id)

      // 15일 cutoff → 30일 전 batch만 purge
      const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000
      const purgedCount = trashService.sweep(ws.id, FIFTEEN_DAYS)

      expect(purgedCount).toBe(1)

      // Old todo는 영구 삭제 — DB에서도 사라짐
      const oldRow = testDb
        .select()
        .from(schema.todos)
        .where(eq(schema.todos.id, todoOld.id))
        .get()
      expect(oldRow).toBeUndefined()

      // Fresh todo는 여전히 trash 상태
      const freshRow = testDb
        .select()
        .from(schema.todos)
        .where(eq(schema.todos.id, todoFresh.id))
        .get()
      expect(freshRow?.deletedAt).not.toBeNull()

      // 남은 batch는 1개 (fresh)
      const remaining = testDb
        .select()
        .from(schema.trashBatches)
        .where(eq(schema.trashBatches.workspaceId, ws.id))
        .all()
      expect(remaining.length).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

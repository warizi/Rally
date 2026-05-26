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
      const oldRow = testDb.select().from(schema.todos).where(eq(schema.todos.id, todoOld.id)).get()
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

  // ──────────────────────────────────────────────
  // S6: retention 경계값 — 1/7/30/90/365 일별 sweepAll 동작
  // ──────────────────────────────────────────────
  describe('S6 — retention 경계값', () => {
    it.each([
      ['1', 1],
      ['7', 7],
      ['30', 30],
      ['90', 90],
      ['365', 365]
    ] as const)('retention=%s sweepAll → cutoff 경과 batch만 purge', (retentionKey, days) => {
      vi.useFakeTimers()
      try {
        const ws = seed.workspace({ path: wsDir })
        const oldTodo = seed.todo(ws.id, { title: 'Old' })
        const freshTodo = seed.todo(ws.id, { title: 'Fresh' })

        const dayMs = 24 * 60 * 60 * 1000
        // retention + 1 일 전 삭제 (만료 대상)
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
        trashService.softRemove(ws.id, 'todo', oldTodo.id)

        // 오늘 삭제 (보존)
        const now = new Date(new Date('2026-01-01T00:00:00Z').getTime() + (days + 2) * dayMs)
        vi.setSystemTime(now)
        trashService.softRemove(ws.id, 'todo', freshTodo.id)

        trashService.setRetention(retentionKey)
        const purged = trashService.sweepAll()

        expect(purged, `retention=${retentionKey}: 만료 batch 1개 purge`).toBe(1)

        // Old 는 hard delete, Fresh 는 여전히 trash
        const oldRow = testDb
          .select()
          .from(schema.todos)
          .where(eq(schema.todos.id, oldTodo.id))
          .get()
        const freshRow = testDb
          .select()
          .from(schema.todos)
          .where(eq(schema.todos.id, freshTodo.id))
          .get()
        expect(oldRow).toBeUndefined()
        expect(freshRow?.deletedAt).not.toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })

    it("retention='never' 는 sweepAll 호출해도 0 — 오래된 batch 도 보존", () => {
      vi.useFakeTimers()
      try {
        const ws = seed.workspace({ path: wsDir })
        const todo = seed.todo(ws.id, { title: 'Ancient' })

        // 10년 전 삭제
        vi.setSystemTime(new Date('2016-01-01T00:00:00Z'))
        trashService.softRemove(ws.id, 'todo', todo.id)

        vi.setSystemTime(new Date('2026-05-12T00:00:00Z'))
        trashService.setRetention('never')

        const purged = trashService.sweepAll()
        expect(purged).toBe(0)

        // batch 여전히 존재
        const batches = testDb
          .select()
          .from(schema.trashBatches)
          .where(eq(schema.trashBatches.workspaceId, ws.id))
          .all()
        expect(batches.length).toBe(1)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  // ──────────────────────────────────────────────
  // S6.5: template handler — soft delete / restore (커버리지 보강)
  // ──────────────────────────────────────────────
  it('S6.5 — template softRemove + restore round-trip', () => {
    const ws = seed.workspace({ path: wsDir })
    // template entity 는 seed 헬퍼가 없으므로 직접 insert
    const tplId = 'tpl-' + Date.now()
    testDb
      .insert(schema.templates)
      .values({
        id: tplId,
        workspaceId: ws.id,
        type: 'note',
        title: 'Daily Standup',
        jsonData: JSON.stringify({ body: 'standup template' }),
        createdAt: new Date()
      })
      .run()

    const batchId = trashService.softRemove(ws.id, 'template', tplId)
    expect(batchId).toBeTruthy()

    // template row 가 trash 상태
    const trashed = testDb
      .select()
      .from(schema.templates)
      .where(eq(schema.templates.id, tplId))
      .get()
    expect(trashed?.deletedAt).not.toBeNull()
    expect(trashed?.trashBatchId).toBe(batchId)

    // restore
    trashService.restore(batchId)
    const restored = testDb
      .select()
      .from(schema.templates)
      .where(eq(schema.templates.id, tplId))
      .get()
    expect(restored?.deletedAt).toBeNull()
    expect(restored?.trashBatchId).toBeNull()
  })

  // ──────────────────────────────────────────────
  // S7: 양방향 entity link 정리 — note 삭제 시 양쪽 모두 정리 + snapshot 보관
  // ──────────────────────────────────────────────
  it('S7 — softRemove(note) cleans both directions of entity_links + captures snapshot', () => {
    const ws = seed.workspace({ path: wsDir })
    const note = seed.note(ws.id, { title: 'N' })
    const todo = seed.todo(ws.id, { title: 'T' })

    // note → todo (forward)
    testDb
      .insert(schema.entityLinks)
      .values({
        sourceType: 'note',
        sourceId: note.id,
        targetType: 'todo',
        targetId: todo.id,
        workspaceId: ws.id,
        createdAt: new Date()
      })
      .run()
    // todo → note (reverse) — 양방향 link 검증
    testDb
      .insert(schema.entityLinks)
      .values({
        sourceType: 'todo',
        sourceId: todo.id,
        targetType: 'note',
        targetId: note.id,
        workspaceId: ws.id,
        createdAt: new Date()
      })
      .run()

    const beforeLinks = testDb.select().from(schema.entityLinks).all()
    expect(beforeLinks.length).toBe(2)

    const batchId = trashService.softRemove(ws.id, 'note', note.id)

    // 양방향 모두 hard delete
    const afterLinks = testDb.select().from(schema.entityLinks).all()
    expect(afterLinks.length).toBe(0)

    // batch metadata 에 양방향 snapshot 보관
    const batchRow = testDb
      .select()
      .from(schema.trashBatches)
      .where(eq(schema.trashBatches.id, batchId))
      .get()
    expect(batchRow?.metadata).not.toBeNull()
    const meta = JSON.parse(batchRow!.metadata!) as {
      links?: Array<{
        sourceType: string
        sourceId: string
        targetType: string
        targetId: string
      }>
    }
    expect(meta.links).toBeDefined()
    expect(meta.links!.length).toBe(2)

    // restore 시 양방향 모두 복원
    trashService.restore(batchId)
    const restoredLinks = testDb.select().from(schema.entityLinks).all()
    expect(restoredLinks.length).toBe(2)
  })
})

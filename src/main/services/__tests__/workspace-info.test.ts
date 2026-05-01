import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { workspaceInfoService } from '../workspace-info'

const WS_A = 'ws-info-a'
const WS_B = 'ws-info-b'

beforeEach(() => {
  testDb.delete(schema.itemTags).run()
  testDb.delete(schema.tags).run()
  testDb.delete(schema.templates).run()
  testDb.delete(schema.recurringCompletions).run()
  testDb.delete(schema.recurringRules).run()
  testDb.delete(schema.schedules).run()
  testDb.delete(schema.imageFiles).run()
  testDb.delete(schema.pdfFiles).run()
  testDb.delete(schema.canvases).run()
  testDb.delete(schema.csvFiles).run()
  testDb.delete(schema.notes).run()
  testDb.delete(schema.todos).run()
  testDb.delete(schema.folders).run()
  testDb.delete(schema.workspaces).run()
  testDb
    .insert(schema.workspaces)
    .values([
      { id: WS_A, name: 'A', path: '/a', createdAt: new Date(), updatedAt: new Date() },
      { id: WS_B, name: 'B', path: '/b', createdAt: new Date(), updatedAt: new Date() }
    ])
    .run()
})

function seedNote(id: string, ws = WS_A, updatedAt = new Date()): void {
  testDb
    .insert(schema.notes)
    .values({
      id,
      workspaceId: ws,
      title: id,
      relativePath: `${id}.md`,
      createdAt: updatedAt,
      updatedAt
    })
    .run()
}

function seedTodo(id: string, isDone = false, ws = WS_A, updatedAt = new Date()): void {
  testDb
    .insert(schema.todos)
    .values({
      id,
      workspaceId: ws,
      title: id,
      isDone,
      createdAt: updatedAt,
      updatedAt
    })
    .run()
}

function seedTemplate(id: string, type: 'note' | 'csv', ws = WS_A): void {
  testDb
    .insert(schema.templates)
    .values({
      id,
      workspaceId: ws,
      title: id,
      type,
      jsonData: '{}',
      createdAt: new Date()
    })
    .run()
}

function seedTag(id: string, ws = WS_A): void {
  testDb
    .insert(schema.tags)
    .values({
      id,
      workspaceId: ws,
      name: id,
      color: '#000',
      createdAt: new Date()
    })
    .run()
}

describe('workspaceInfoService.getStats', () => {
  it('빈 워크스페이스는 0 카운트', () => {
    const stats = workspaceInfoService.getStats(WS_A)
    expect(stats.notes).toBe(0)
    expect(stats.tables).toBe(0)
    expect(stats.canvases).toBe(0)
    expect(stats.todos).toEqual({ active: 0, completed: 0, total: 0 })
    expect(stats.templates).toEqual({ note: 0, csv: 0, total: 0 })
  })

  it('todo active/completed 분리 카운트', () => {
    seedTodo('t-1', false)
    seedTodo('t-2', false)
    seedTodo('t-3', true)
    const stats = workspaceInfoService.getStats(WS_A, ['todos'])
    expect(stats.todos).toEqual({ active: 2, completed: 1, total: 3 })
  })

  it('templates type별 카운트', () => {
    seedTemplate('tpl-1', 'note')
    seedTemplate('tpl-2', 'note')
    seedTemplate('tpl-3', 'csv')
    const stats = workspaceInfoService.getStats(WS_A, ['templates'])
    expect(stats.templates).toEqual({ note: 2, csv: 1, total: 3 })
  })

  it('워크스페이스 격리: 다른 ws 데이터는 카운트 안 됨', () => {
    seedNote('n-a', WS_A)
    seedNote('n-b', WS_B)
    seedTag('tag-a', WS_A)
    seedTag('tag-b', WS_B)
    const a = workspaceInfoService.getStats(WS_A)
    const b = workspaceInfoService.getStats(WS_B)
    expect(a.notes).toBe(1)
    expect(b.notes).toBe(1)
    expect(a.tags).toBe(1)
    expect(b.tags).toBe(1)
  })

  it('kinds 필터: 요청한 종류만 응답에 포함', () => {
    seedNote('n-1')
    seedTodo('td-1')
    const stats = workspaceInfoService.getStats(WS_A, ['notes'])
    expect(stats.notes).toBe(1)
    expect(stats.todos).toBeUndefined()
    expect(stats.canvases).toBeUndefined()
  })
})

describe('workspaceInfoService.getInfo', () => {
  it('메타 + stats + recentActivity 반환', () => {
    seedNote('n-1', WS_A, new Date('2026-04-01T00:00:00Z'))
    seedTodo('td-1', false, WS_A, new Date('2026-05-01T00:00:00Z'))
    const info = workspaceInfoService.getInfo(WS_A, 5)
    expect(info.id).toBe(WS_A)
    expect(info.name).toBe('A')
    expect(info.stats.notes).toBe(1)
    expect(info.stats.todos.total).toBe(1)
    expect(info.recentActivity).toHaveLength(2)
    // updatedAt desc — todo가 더 최신이므로 첫 번째
    expect(info.recentActivity[0].type).toBe('todo')
    expect(info.recentActivity[1].type).toBe('note')
  })

  it('recentLimit 적용', () => {
    seedNote('n-1', WS_A, new Date('2026-04-01T00:00:00Z'))
    seedNote('n-2', WS_A, new Date('2026-04-02T00:00:00Z'))
    seedNote('n-3', WS_A, new Date('2026-04-03T00:00:00Z'))
    const info = workspaceInfoService.getInfo(WS_A, 2)
    expect(info.recentActivity).toHaveLength(2)
    // 가장 최신 2개
    expect(info.recentActivity.map((r) => r.id)).toEqual(['n-3', 'n-2'])
  })
})

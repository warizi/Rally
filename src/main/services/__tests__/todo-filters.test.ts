import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { todoService } from '../todo'

const WS_ID = 'ws-tf'

beforeEach(() => {
  testDb.delete(schema.entityLinks).run()
  testDb.delete(schema.todos).run()
  testDb.delete(schema.notes).run()
  testDb.delete(schema.workspaces).run()
  testDb
    .insert(schema.workspaces)
    .values({ id: WS_ID, name: 'Test', path: '/t', createdAt: new Date(), updatedAt: new Date() })
    .run()
})

function seedTodo(
  id: string,
  data: Partial<{
    title: string
    parentId: string | null
    priority: 'high' | 'medium' | 'low'
    isDone: boolean
    dueDate: Date | null
  }> = {}
): void {
  testDb
    .insert(schema.todos)
    .values({
      id,
      workspaceId: WS_ID,
      title: data.title ?? id,
      parentId: data.parentId ?? null,
      priority: data.priority ?? 'medium',
      isDone: data.isDone ?? false,
      dueDate: data.dueDate ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function seedNote(id: string): void {
  testDb
    .insert(schema.notes)
    .values({
      id,
      workspaceId: WS_ID,
      title: id,
      relativePath: `${id}.md`,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function link(sType: string, sId: string, tType: string, tId: string): void {
  testDb
    .insert(schema.entityLinks)
    .values({
      sourceType: sType,
      sourceId: sId,
      targetType: tType,
      targetId: tId,
      workspaceId: WS_ID,
      createdAt: new Date()
    })
    .run()
}

describe('todoService.findByWorkspaceFiltered', () => {
  describe('parentId 필터', () => {
    it('parentId=null이면 top-level todos만', () => {
      seedTodo('top-1')
      seedTodo('top-2')
      seedTodo('sub-1', { parentId: 'top-1' })
      const r = todoService.findByWorkspaceFiltered(WS_ID, { parentId: null, filter: 'all' })
      expect(r.map((t) => t.id).sort()).toEqual(['top-1', 'top-2'])
    })

    it('parentId=특정id면 해당 부모의 자식들만', () => {
      seedTodo('top-1')
      seedTodo('top-2')
      seedTodo('sub-1', { parentId: 'top-1' })
      seedTodo('sub-2', { parentId: 'top-1' })
      seedTodo('sub-3', { parentId: 'top-2' })
      const r = todoService.findByWorkspaceFiltered(WS_ID, {
        parentId: 'top-1',
        filter: 'all'
      })
      expect(r.map((t) => t.id).sort()).toEqual(['sub-1', 'sub-2'])
    })
  })

  describe('linkedTo 필터', () => {
    it('특정 note에 연결된 todo만 반환', () => {
      seedTodo('td-1')
      seedTodo('td-2')
      seedTodo('td-3')
      seedNote('n-1')
      // 정규화상 note < todo
      link('note', 'n-1', 'todo', 'td-1')
      link('note', 'n-1', 'todo', 'td-3')
      const r = todoService.findByWorkspaceFiltered(WS_ID, {
        filter: 'all',
        linkedTo: { type: 'note', id: 'n-1' }
      })
      expect(r.map((t) => t.id).sort()).toEqual(['td-1', 'td-3'])
    })

    it('연결된 todo가 없으면 빈 배열 (DB 풀 fetch 회피)', () => {
      seedTodo('td-1')
      seedNote('n-1')
      const r = todoService.findByWorkspaceFiltered(WS_ID, {
        filter: 'all',
        linkedTo: { type: 'note', id: 'n-1' }
      })
      expect(r).toEqual([])
    })
  })

  describe('dueWithin 필터', () => {
    it('오늘 기준 N일 이내 dueDate만', () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)
      const farFuture = new Date(today)
      farFuture.setDate(today.getDate() + 30)
      const past = new Date(today)
      past.setDate(today.getDate() - 5)

      seedTodo('soon', { dueDate: tomorrow })
      seedTodo('later', { dueDate: farFuture })
      seedTodo('overdue', { dueDate: past })
      seedTodo('no-due')

      const r = todoService.findByWorkspaceFiltered(WS_ID, { filter: 'all', dueWithin: 7 })
      expect(r.map((t) => t.id)).toEqual(['soon'])
    })
  })

  describe('priority 필터', () => {
    it('priority 배열 중 하나에 매칭되는 todo만', () => {
      seedTodo('h-1', { priority: 'high' })
      seedTodo('m-1', { priority: 'medium' })
      seedTodo('l-1', { priority: 'low' })
      const r = todoService.findByWorkspaceFiltered(WS_ID, {
        filter: 'all',
        priority: ['high', 'low']
      })
      expect(r.map((t) => t.id).sort()).toEqual(['h-1', 'l-1'])
    })
  })

  describe('search 필터', () => {
    it('title 부분 매칭', () => {
      seedTodo('a', { title: 'Read book' })
      seedTodo('b', { title: 'Write README' })
      seedTodo('c', { title: 'Deploy app' })
      const r = todoService.findByWorkspaceFiltered(WS_ID, { filter: 'all', search: 'read' })
      expect(r.map((t) => t.id).sort()).toEqual(['a', 'b'])
    })

    it('빈 search는 무시 (모두 반환)', () => {
      seedTodo('a')
      seedTodo('b')
      const r = todoService.findByWorkspaceFiltered(WS_ID, { filter: 'all', search: '   ' })
      expect(r.map((t) => t.id).sort()).toEqual(['a', 'b'])
    })
  })

  describe('조합 필터', () => {
    it('parentId=null + priority=high + filter=active', () => {
      seedTodo('h-top', { priority: 'high' })
      seedTodo('h-top-done', { priority: 'high', isDone: true })
      seedTodo('h-sub', { priority: 'high', parentId: 'h-top' })
      seedTodo('m-top', { priority: 'medium' })
      const r = todoService.findByWorkspaceFiltered(WS_ID, {
        parentId: null,
        priority: ['high'],
        filter: 'active'
      })
      expect(r.map((t) => t.id)).toEqual(['h-top'])
    })
  })
})

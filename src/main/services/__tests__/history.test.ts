/**
 * historyService 통합 테스트 (testDb 사용).
 *
 * - fetch: 완료된 todo + recurring completion 을 day-grouped 으로 반환
 * - 날짜 필터 (fromDate / toDate)
 * - text query (todo 제목 + 링크된 파일 제목 매치)
 * - 페이지네이션 (dayOffset / dayLimit / hasMore / nextDayOffset)
 * - parent-child 정렬 (parent 가 같은 day 에 있으면 그 직후에 sub 그룹)
 * - entity-link → HistoryLink 직렬화
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { historyService } from '../history'

const WS_ID = 'ws-aabbcc1'

beforeEach(() => {
  testDb
    .insert(schema.workspaces)
    .values({
      id: WS_ID,
      name: 'Test',
      path: '/test',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
})

function insertTodo(opts: {
  id: string
  title?: string
  parentId?: string | null
  isDone?: boolean
  doneAt?: Date | null
}): void {
  testDb
    .insert(schema.todos)
    .values({
      id: opts.id,
      workspaceId: WS_ID,
      parentId: opts.parentId ?? null,
      title: opts.title ?? `todo-${opts.id}`,
      description: '',
      status: opts.isDone ? '완료' : '할일',
      priority: 'medium',
      isDone: opts.isDone ?? false,
      listOrder: 0,
      kanbanOrder: 0,
      subOrder: 0,
      doneAt: opts.doneAt ?? null,
      dueDate: null,
      startDate: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01')
    })
    .run()
}

function insertNote(id: string, title: string): void {
  testDb
    .insert(schema.notes)
    .values({
      id,
      workspaceId: WS_ID,
      folderId: null,
      title,
      relativePath: `${title}.md`,
      description: '',
      preview: '',
      order: 0,
      isLocked: false,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function insertLink(noteId: string, todoId: string): void {
  // entityLinks 는 composite PK (sourceType+sourceId+targetType+targetId), id 없음
  testDb
    .insert(schema.entityLinks)
    .values({
      workspaceId: WS_ID,
      sourceType: 'note',
      sourceId: noteId,
      targetType: 'todo',
      targetId: todoId,
      createdAt: new Date()
    })
    .run()
}

function insertRecurringCompletion(opts: {
  id: string
  ruleId?: string | null
  ruleTitle: string
  completedAt: Date
  completedDate?: string
}): void {
  testDb
    .insert(schema.recurringCompletions)
    .values({
      id: opts.id,
      workspaceId: WS_ID,
      ruleId: opts.ruleId ?? null,
      ruleTitle: opts.ruleTitle,
      completedDate: opts.completedDate ?? '2026-05-29',
      completedAt: opts.completedAt,
      createdAt: opts.completedAt
    })
    .run()
}

describe('historyService.fetch — empty / basic', () => {
  it('완료된 todo 없음 → 빈 days', () => {
    const result = historyService.fetch(WS_ID)
    expect(result.days).toEqual([])
    expect(result.hasMore).toBe(false)
    expect(result.nextDayOffset).toBe(0)
  })

  it('완료 todo 1개 → 해당 날짜 day 에 단건 entry', () => {
    insertTodo({ id: 'tt-aabbcc1', title: '할일1', isDone: true, doneAt: new Date('2026-05-28T10:00:00') })
    const result = historyService.fetch(WS_ID)

    expect(result.days).toHaveLength(1)
    expect(result.days[0].todos).toHaveLength(1)
    expect(result.days[0].todos[0].title).toBe('할일1')
    expect(result.days[0].todos[0].kind).toBe('todo')
  })

  it('완료되지 않은 todo 는 제외', () => {
    insertTodo({ id: 'tt-active01', title: '미완', isDone: false, doneAt: null })
    const result = historyService.fetch(WS_ID)
    expect(result.days).toEqual([])
  })
})

describe('historyService.fetch — date filter', () => {
  it('fromDate / toDate 범위 밖 day 는 제외', () => {
    insertTodo({ id: 'tt-inrange', isDone: true, doneAt: new Date('2026-05-15T10:00:00') })
    insertTodo({ id: 'tt-outside', isDone: true, doneAt: new Date('2026-04-30T10:00:00') })

    const result = historyService.fetch(WS_ID, { fromDate: '2026-05-01', toDate: '2026-05-31' })
    const allIds = result.days.flatMap((d) => d.todos.map((t) => t.id))
    expect(allIds).toContain('tt-inrange')
    expect(allIds).not.toContain('tt-outside')
  })
})

describe('historyService.fetch — recurring completion', () => {
  it('recurring completion → days 에 kind="recurring" 으로 포함, id 는 recurring: prefix', () => {
    // history.ts 는 완료 todo 가 0개면 early return 하므로 anchor todo 도 함께 삽입
    insertTodo({
      id: 'tt-anchor01',
      title: '앵커',
      isDone: true,
      doneAt: new Date('2026-05-28T08:00:00')
    })
    insertRecurringCompletion({
      id: 'rc-aabbcc1',
      ruleTitle: '데일리 스탠드업',
      completedAt: new Date('2026-05-28T09:00:00')
    })

    const result = historyService.fetch(WS_ID)
    expect(result.days).toHaveLength(1)
    const recurring = result.days[0].todos.find((t) => t.kind === 'recurring')
    expect(recurring).toBeDefined()
    expect(recurring!.id).toBe('recurring:rc-aabbcc1')
    expect(recurring!.links).toEqual([])
  })
})

describe('historyService.fetch — entity links', () => {
  it('todo 와 연결된 note → HistoryLink 배열에 포함', () => {
    insertTodo({ id: 'tt-link0001', title: 'with link', isDone: true, doneAt: new Date('2026-05-28T10:00:00') })
    insertNote('nt-aabbcc1', 'attached')
    insertLink('nt-aabbcc1', 'tt-link0001')

    const result = historyService.fetch(WS_ID)
    expect(result.days).toHaveLength(1)
    const entry = result.days[0].todos[0]
    expect(entry.links).toHaveLength(1)
    expect(entry.links[0]).toMatchObject({
      type: 'note',
      id: 'nt-aabbcc1',
      title: 'attached'
    })
  })
})

describe('historyService.fetch — query', () => {
  it('query 매치되는 day 만 반환 (제목 또는 링크 제목 매치)', () => {
    insertTodo({ id: 'tt-meeting1', title: 'meeting prep', isDone: true, doneAt: new Date('2026-05-28T10:00:00') })
    insertTodo({ id: 'tt-other001', title: 'other', isDone: true, doneAt: new Date('2026-05-27T10:00:00') })

    const result = historyService.fetch(WS_ID, { query: 'meeting' })
    expect(result.days).toHaveLength(1)
    expect(result.days[0].todos[0].id).toBe('tt-meeting1')
  })

  it('query 가 어떤 entry 와도 매치 안 됨 → 빈 days', () => {
    insertTodo({ id: 'tt-nope0001', title: 'foo', isDone: true, doneAt: new Date('2026-05-28T10:00:00') })

    const result = historyService.fetch(WS_ID, { query: 'nothing-here' })
    expect(result.days).toEqual([])
  })
})

describe('historyService.fetch — pagination', () => {
  it('dayLimit 적용 + hasMore + nextDayOffset', () => {
    // 3 일자에 걸쳐 완료
    insertTodo({ id: 'tt-day1aaaa', isDone: true, doneAt: new Date('2026-05-26T10:00:00') })
    insertTodo({ id: 'tt-day2aaaa', isDone: true, doneAt: new Date('2026-05-27T10:00:00') })
    insertTodo({ id: 'tt-day3aaaa', isDone: true, doneAt: new Date('2026-05-28T10:00:00') })

    const result = historyService.fetch(WS_ID, { dayOffset: 0, dayLimit: 2 })
    expect(result.days).toHaveLength(2)
    // desc 정렬 — 최근 day 가 먼저
    expect(result.days[0].todos[0].id).toBe('tt-day3aaaa')
    expect(result.days[1].todos[0].id).toBe('tt-day2aaaa')
    expect(result.hasMore).toBe(true)
    expect(result.nextDayOffset).toBe(2)
  })

  it('dayOffset 으로 다음 페이지 fetch', () => {
    insertTodo({ id: 'tt-day1bbbb', isDone: true, doneAt: new Date('2026-05-26T10:00:00') })
    insertTodo({ id: 'tt-day2bbbb', isDone: true, doneAt: new Date('2026-05-27T10:00:00') })
    insertTodo({ id: 'tt-day3bbbb', isDone: true, doneAt: new Date('2026-05-28T10:00:00') })

    const result = historyService.fetch(WS_ID, { dayOffset: 2, dayLimit: 2 })
    expect(result.days).toHaveLength(1)
    expect(result.days[0].todos[0].id).toBe('tt-day1bbbb')
    expect(result.hasMore).toBe(false)
  })
})

describe('historyService.fetch — parent-child grouping', () => {
  it('parent + 같은 day 의 sub → parent 직후에 sub 가 그룹화', () => {
    insertTodo({ id: 'tt-parent01', title: 'parent', isDone: true, doneAt: new Date('2026-05-28T15:00:00') })
    insertTodo({
      id: 'tt-sub00001',
      title: 'sub-A',
      isDone: true,
      doneAt: new Date('2026-05-28T14:00:00'),
      parentId: 'tt-parent01'
    })
    insertTodo({
      id: 'tt-other001',
      title: 'unrelated',
      isDone: true,
      doneAt: new Date('2026-05-28T13:00:00')
    })

    const result = historyService.fetch(WS_ID)
    expect(result.days).toHaveLength(1)
    const ids = result.days[0].todos.map((t) => t.id)
    const parentIdx = ids.indexOf('tt-parent01')
    const subIdx = ids.indexOf('tt-sub00001')
    expect(parentIdx).toBeGreaterThanOrEqual(0)
    expect(subIdx).toBe(parentIdx + 1)

    // sub 의 parentTitle 채워짐
    const sub = result.days[0].todos.find((t) => t.id === 'tt-sub00001')!
    expect(sub.parentTitle).toBe('parent')
  })

  it('parent 가 같은 day 에 없는 sub → 자기 시각 기준 top-level 처럼 배치', () => {
    insertTodo({ id: 'tt-poff0001', title: 'parent (other day)', isDone: false, doneAt: null })
    insertTodo({
      id: 'tt-sub00002',
      title: 'orphan-sub',
      isDone: true,
      doneAt: new Date('2026-05-28T10:00:00'),
      parentId: 'tt-poff0001'
    })

    const result = historyService.fetch(WS_ID)
    expect(result.days).toHaveLength(1)
    expect(result.days[0].todos).toHaveLength(1)
    expect(result.days[0].todos[0].id).toBe('tt-sub00002')
    expect(result.days[0].todos[0].parentTitle).toBe('parent (other day)')
  })
})

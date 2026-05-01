import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { entityLinkService } from '../entity-link'

// 통합 테스트: 실제 in-memory DB를 사용해 getLinkedBatch / getLinkedBatchWithPreview 검증.
// 단위 테스트로 mocking이 어려운(여러 도메인 inArray 호출) 부분을 커버.

const WS_ID = 'ws-batch'

beforeEach(() => {
  // setup.ts의 cleanup은 일부 테이블만 처리하므로 본 파일에서 사용하는 테이블을 직접 정리
  testDb.delete(schema.entityLinks).run()
  testDb.delete(schema.notes).run()
  testDb.delete(schema.csvFiles).run()
  testDb.delete(schema.canvases).run()
  testDb.delete(schema.todos).run()
  testDb.delete(schema.workspaces).run()
  testDb
    .insert(schema.workspaces)
    .values({ id: WS_ID, name: 'Test', path: '/t', createdAt: new Date(), updatedAt: new Date() })
    .run()
})

function seedTodo(id: string, title = id): void {
  testDb
    .insert(schema.todos)
    .values({
      id,
      workspaceId: WS_ID,
      title,
      description: `desc of ${id}`,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function seedNote(id: string, title = id, preview = `preview of ${id}`): void {
  testDb
    .insert(schema.notes)
    .values({
      id,
      workspaceId: WS_ID,
      title,
      relativePath: `${id}.md`,
      preview,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function seedCsv(id: string, title = id, preview = `csv preview of ${id}`): void {
  testDb
    .insert(schema.csvFiles)
    .values({
      id,
      workspaceId: WS_ID,
      title,
      relativePath: `${id}.csv`,
      preview,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function seedCanvas(id: string, title = id, description = `canvas desc of ${id}`): void {
  testDb
    .insert(schema.canvases)
    .values({
      id,
      workspaceId: WS_ID,
      title,
      description,
      viewportX: 0,
      viewportY: 0,
      viewportZoom: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function link(
  sType: string,
  sId: string,
  tType: string,
  tId: string,
  createdAt = new Date()
): void {
  // entityLinkRepository.link normalizes by type — 여기선 normalize 통과한 row를 직접 insert
  testDb
    .insert(schema.entityLinks)
    .values({
      sourceType: sType,
      sourceId: sId,
      targetType: tType,
      targetId: tId,
      workspaceId: WS_ID,
      createdAt
    })
    .run()
}

describe('entityLinkService.getLinkedBatch', () => {
  it('빈 입력은 빈 Map 반환', () => {
    const r = entityLinkService.getLinkedBatch('todo', [])
    expect(r.size).toBe(0)
  })

  it('todo↔note + todo↔csv 링크를 모두 그룹화', () => {
    seedTodo('td-1')
    seedNote('n-1', 'Note One')
    seedCsv('c-1', 'Csv One')
    // 정규화상 canvas/csv/note < todo이므로 source가 다른 type, target이 todo
    link('note', 'n-1', 'todo', 'td-1')
    link('csv', 'c-1', 'todo', 'td-1')

    const r = entityLinkService.getLinkedBatch('todo', ['td-1'])
    const list = r.get('td-1') ?? []
    expect(list).toHaveLength(2)
    const titles = list.map((l) => l.title).sort()
    expect(titles).toEqual(['Csv One', 'Note One'])
  })

  it('orphan(존재하지 않는 entity)은 결과에서 빠짐', () => {
    seedTodo('td-1')
    // note 'n-missing'은 시드하지 않음
    link('note', 'n-missing', 'todo', 'td-1')
    seedNote('n-1', 'Real Note')
    link('note', 'n-1', 'todo', 'td-1')

    const r = entityLinkService.getLinkedBatch('todo', ['td-1'])
    const list = r.get('td-1') ?? []
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('Real Note')
  })
})

describe('entityLinkService.getLinkedBatchWithPreview', () => {
  it('각 link에 type별 preview/description이 채워진다', () => {
    seedTodo('td-1')
    seedNote('n-1', 'Note One', 'note preview here')
    seedCsv('c-1', 'Csv One', 'csv preview here')
    seedCanvas('cv-1', 'Canvas One', 'canvas desc here')
    seedTodo('td-2', 'Todo Two')
    link('note', 'n-1', 'todo', 'td-1')
    link('csv', 'c-1', 'todo', 'td-1')
    link('canvas', 'cv-1', 'todo', 'td-1')
    // todo-todo: 같은 type이라 정규화로 idA<idB → source='td-1', target='td-2'
    link('todo', 'td-1', 'todo', 'td-2')

    const r = entityLinkService.getLinkedBatchWithPreview('todo', ['td-1'])
    const list = r.get('td-1') ?? []
    expect(list).toHaveLength(4)
    const byType = new Map(list.map((l) => [l.entityType, l.preview]))
    expect(byType.get('note')).toBe('note preview here')
    expect(byType.get('csv')).toBe('csv preview here')
    expect(byType.get('canvas')).toBe('canvas desc here')
    expect(byType.get('todo')).toBe('desc of td-2')
  })

  it('빈 preview/description은 null로 정규화', () => {
    seedTodo('td-1')
    // 빈 preview 노트
    testDb
      .insert(schema.notes)
      .values({
        id: 'n-empty',
        workspaceId: WS_ID,
        title: 'Empty',
        relativePath: 'empty.md',
        preview: '',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .run()
    link('note', 'n-empty', 'todo', 'td-1')

    const r = entityLinkService.getLinkedBatchWithPreview('todo', ['td-1'])
    const list = r.get('td-1') ?? []
    expect(list).toHaveLength(1)
    expect(list[0].preview).toBe(null)
  })

  it('빈 입력은 빈 Map', () => {
    const r = entityLinkService.getLinkedBatchWithPreview('todo', [])
    expect(r.size).toBe(0)
  })
})

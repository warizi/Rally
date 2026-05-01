import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { templateService } from '../template'
import { tagService } from '../tag'
import { itemTagService } from '../item-tag'

const WS_A = 'ws-cls-a'
const WS_B = 'ws-cls-b'

beforeEach(() => {
  testDb.delete(schema.itemTags).run()
  testDb.delete(schema.tags).run()
  testDb.delete(schema.templates).run()
  testDb.delete(schema.notes).run()
  testDb.delete(schema.workspaces).run()
  testDb
    .insert(schema.workspaces)
    .values([
      { id: WS_A, name: 'A', path: '/a', createdAt: new Date(), updatedAt: new Date() },
      { id: WS_B, name: 'B', path: '/b', createdAt: new Date(), updatedAt: new Date() }
    ])
    .run()
})

describe('templateService — listAll + findById', () => {
  it('listAll: type 미지정이면 모든 type, 지정 시 필터', () => {
    templateService.create({
      workspaceId: WS_A,
      title: 'Note Tpl',
      type: 'note',
      jsonData: '{"x":1}'
    })
    templateService.create({
      workspaceId: WS_A,
      title: 'CSV Tpl',
      type: 'csv',
      jsonData: 'a,b\n1,2'
    })
    expect(templateService.listAll(WS_A)).toHaveLength(2)
    expect(templateService.listAll(WS_A, 'note')).toHaveLength(1)
    expect(templateService.listAll(WS_A, 'csv')).toHaveLength(1)
  })

  it('워크스페이스 격리', () => {
    templateService.create({
      workspaceId: WS_A,
      title: 'A only',
      type: 'note',
      jsonData: '{}'
    })
    expect(templateService.listAll(WS_B)).toHaveLength(0)
  })

  it('findById는 jsonData 포함', () => {
    const created = templateService.create({
      workspaceId: WS_A,
      title: 'with data',
      type: 'note',
      jsonData: '{"a":1}'
    })
    const found = templateService.findById(created.id)
    expect(found.jsonData).toBe('{"a":1}')
  })

  it('잘못된 ID는 NotFoundError', () => {
    expect(() => templateService.findById('bogus')).toThrow()
  })
})

describe('tagService + itemTagService — MCP 시나리오', () => {
  function seedNote(id: string, ws = WS_A): void {
    testDb
      .insert(schema.notes)
      .values({
        id,
        workspaceId: ws,
        title: `note ${id}`,
        relativePath: `${id}.md`,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .run()
  }

  it('tag CRUD 라이프사이클', () => {
    const tag = tagService.create(WS_A, { name: 'important', color: '#f00' })
    expect(tag.name).toBe('important')

    const updated = tagService.update(tag.id, { name: 'urgent' })
    expect(updated.name).toBe('urgent')

    tagService.remove(tag.id)
    expect(tagService.getAll(WS_A)).toHaveLength(0)
  })

  it('동일 ws에서 같은 이름의 태그는 ConflictError', () => {
    tagService.create(WS_A, { name: 'dup', color: '#f00' })
    expect(() => tagService.create(WS_A, { name: 'dup', color: '#0f0' })).toThrow()
  })

  it('다른 워크스페이스에선 같은 이름 허용', () => {
    tagService.create(WS_A, { name: 'shared', color: '#f00' })
    const t2 = tagService.create(WS_B, { name: 'shared', color: '#f00' })
    expect(t2.workspaceId).toBe(WS_B)
  })

  it('attach/detach + getTagsByItem + getItemIdsByTag', () => {
    const tag = tagService.create(WS_A, { name: 't1', color: '#f00' })
    seedNote('n-1')
    seedNote('n-2')
    itemTagService.attach('note', tag.id, 'n-1')
    itemTagService.attach('note', tag.id, 'n-2')

    expect(itemTagService.getItemIdsByTag(tag.id, 'note').sort()).toEqual(['n-1', 'n-2'])
    expect(itemTagService.getTagsByItem('note', 'n-1')).toHaveLength(1)

    itemTagService.detach('note', tag.id, 'n-1')
    expect(itemTagService.getItemIdsByTag(tag.id, 'note')).toEqual(['n-2'])
  })

  it('워크스페이스 격리: WS_A 태그가 WS_B에서 안 보임', () => {
    tagService.create(WS_A, { name: 'a-tag', color: '#f00' })
    expect(tagService.getAll(WS_A)).toHaveLength(1)
    expect(tagService.getAll(WS_B)).toHaveLength(0)
  })

  it('item이 삭제돼도 attachment row는 남음 — orphan은 라우트에서 skip', () => {
    const tag = tagService.create(WS_A, { name: 't', color: '#f00' })
    seedNote('n-temp')
    itemTagService.attach('note', tag.id, 'n-temp')
    // 노트 전체 삭제 → orphan attachment 시뮬레이션
    testDb.delete(schema.notes).run()
    // attachment row는 여전히 존재 (cascade 미설정)
    expect(itemTagService.getItemIdsByTag(tag.id, 'note')).toEqual(['n-temp'])
  })
})

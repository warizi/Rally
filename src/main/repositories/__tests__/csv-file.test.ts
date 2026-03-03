import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { csvFileRepository, type CsvFileInsert } from '../csv-file'

const WS_ID = 'ws-1'

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

function makeCsv(overrides?: Partial<CsvFileInsert>): CsvFileInsert {
  return {
    id: 'csv-1',
    workspaceId: WS_ID,
    folderId: null,
    relativePath: 'test.csv',
    title: 'test',
    description: '',
    preview: '',
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

describe('findByWorkspaceId', () => {
  it('csv 없을 때 빈 배열 반환', () => {
    expect(csvFileRepository.findByWorkspaceId(WS_ID)).toEqual([])
  })

  it('해당 workspace의 csv만 반환 (다른 ws 제외)', () => {
    testDb
      .insert(schema.workspaces)
      .values({
        id: 'ws-2',
        name: 'Other',
        path: '/other',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .run()
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'c1' }))
      .run()
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'c2', workspaceId: 'ws-2', relativePath: 'other.csv' }))
      .run()
    const result = csvFileRepository.findByWorkspaceId(WS_ID)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
  })
})

describe('findById', () => {
  it('존재하는 id → CsvFile 반환', () => {
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'x1' }))
      .run()
    expect(csvFileRepository.findById('x1')).toBeDefined()
  })
  it('없는 id → undefined', () => {
    expect(csvFileRepository.findById('none')).toBeUndefined()
  })
})

describe('findByRelativePath', () => {
  it('workspaceId + relativePath 일치 → CsvFile 반환', () => {
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'rp1', relativePath: 'data/a.csv' }))
      .run()
    const result = csvFileRepository.findByRelativePath(WS_ID, 'data/a.csv')
    expect(result).toBeDefined()
    expect(result!.id).toBe('rp1')
  })
  it('일치 없음 → undefined', () => {
    expect(csvFileRepository.findByRelativePath(WS_ID, 'nope.csv')).toBeUndefined()
  })
})

describe('create', () => {
  it('모든 필드 포함하여 생성 후 반환', () => {
    const row = csvFileRepository.create(makeCsv({ id: 'new-1', title: 'New' }))
    expect(row.id).toBe('new-1')
    expect(row.title).toBe('New')
    expect(row.description).toBe('')
    expect(row.order).toBe(0)
  })
})

describe('createMany', () => {
  it('빈 배열 → no-op', () => {
    csvFileRepository.createMany([])
    expect(csvFileRepository.findByWorkspaceId(WS_ID)).toEqual([])
  })

  it('여러 건 삽입 후 findByWorkspaceId로 확인', () => {
    csvFileRepository.createMany([
      makeCsv({ id: 'cm1', relativePath: 'a.csv' }),
      makeCsv({ id: 'cm2', relativePath: 'b.csv' })
    ])
    expect(csvFileRepository.findByWorkspaceId(WS_ID)).toHaveLength(2)
  })

  it('중복 relativePath → onConflictDoNothing (에러 없음)', () => {
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'dup1', relativePath: 'dup.csv' }))
      .run()
    expect(() =>
      csvFileRepository.createMany([makeCsv({ id: 'dup2', relativePath: 'dup.csv' })])
    ).not.toThrow()
    // 기존 행 유지, 새 행 무시
    expect(csvFileRepository.findById('dup1')).toBeDefined()
    expect(csvFileRepository.findById('dup2')).toBeUndefined()
  })
})

describe('update', () => {
  it('지정 필드만 변경, 나머지 보존', () => {
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'u1', title: '원본', description: '설명' }))
      .run()
    const updated = csvFileRepository.update('u1', { title: '수정' })
    expect(updated?.title).toBe('수정')
    expect(updated?.description).toBe('설명')
  })
  it('없는 id → undefined', () => {
    expect(csvFileRepository.update('ghost', { title: 'x' })).toBeUndefined()
  })
})

describe('deleteOrphans', () => {
  it('existingPaths에 없는 csv 삭제', () => {
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'o1', relativePath: 'keep.csv' }))
      .run()
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'o2', relativePath: 'orphan.csv' }))
      .run()
    csvFileRepository.deleteOrphans(WS_ID, ['keep.csv'])
    expect(csvFileRepository.findById('o1')).toBeDefined()
    expect(csvFileRepository.findById('o2')).toBeUndefined()
  })

  it('existingPaths 빈 배열 → 전체 삭제', () => {
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'o3', relativePath: 'a.csv' }))
      .run()
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'o4', relativePath: 'b.csv' }))
      .run()
    csvFileRepository.deleteOrphans(WS_ID, [])
    expect(csvFileRepository.findByWorkspaceId(WS_ID)).toHaveLength(0)
  })

  it('모두 existingPaths에 있으면 삭제 없음', () => {
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'o5', relativePath: 'x.csv' }))
      .run()
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'o6', relativePath: 'y.csv' }))
      .run()
    csvFileRepository.deleteOrphans(WS_ID, ['x.csv', 'y.csv'])
    expect(csvFileRepository.findByWorkspaceId(WS_ID)).toHaveLength(2)
  })
})

describe('bulkDeleteByPrefix', () => {
  it('prefix 하위 csv만 삭제, 나머지 보존', () => {
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'bp1', relativePath: 'docs/a.csv' }))
      .run()
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'bp2', relativePath: 'docs/sub/b.csv' }))
      .run()
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'bp3', relativePath: 'other.csv' }))
      .run()
    csvFileRepository.bulkDeleteByPrefix(WS_ID, 'docs')
    expect(csvFileRepository.findById('bp1')).toBeUndefined()
    expect(csvFileRepository.findById('bp2')).toBeUndefined()
    expect(csvFileRepository.findById('bp3')).toBeDefined()
  })
})

describe('bulkUpdatePathPrefix', () => {
  it('정확히 oldPrefix와 일치하는 경로 → newPrefix로 변경', () => {
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'pp1', relativePath: 'old-folder' }))
      .run()
    csvFileRepository.bulkUpdatePathPrefix(WS_ID, 'old-folder', 'new-folder')
    expect(csvFileRepository.findById('pp1')!.relativePath).toBe('new-folder')
  })

  it('oldPrefix/ 하위 경로 → newPrefix/ 하위로 변경', () => {
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'pp2', relativePath: 'old-folder/a.csv' }))
      .run()
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'pp3', relativePath: 'other/b.csv' }))
      .run()
    csvFileRepository.bulkUpdatePathPrefix(WS_ID, 'old-folder', 'new-folder')
    expect(csvFileRepository.findById('pp2')!.relativePath).toBe('new-folder/a.csv')
    expect(csvFileRepository.findById('pp3')!.relativePath).toBe('other/b.csv')
  })

  it('updatedAt 갱신 확인', () => {
    const oldDate = new Date('2020-01-01')
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'pp4', relativePath: 'old/c.csv', updatedAt: oldDate }))
      .run()
    csvFileRepository.bulkUpdatePathPrefix(WS_ID, 'old', 'new')
    const row = csvFileRepository.findById('pp4')!
    expect(new Date(row.updatedAt).getTime()).toBeGreaterThan(oldDate.getTime())
  })
})

describe('reindexSiblings', () => {
  it('orderedIds 순서대로 order 재설정', () => {
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'ri1', relativePath: 'r1.csv', order: 5 }))
      .run()
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'ri2', relativePath: 'r2.csv', order: 3 }))
      .run()
    csvFileRepository.reindexSiblings(WS_ID, ['ri2', 'ri1'])
    expect(csvFileRepository.findById('ri2')!.order).toBe(0)
    expect(csvFileRepository.findById('ri1')!.order).toBe(1)
  })
})

describe('delete', () => {
  it('삭제 후 findById → undefined', () => {
    testDb
      .insert(schema.csvFiles)
      .values(makeCsv({ id: 'd1' }))
      .run()
    csvFileRepository.delete('d1')
    expect(csvFileRepository.findById('d1')).toBeUndefined()
  })
})

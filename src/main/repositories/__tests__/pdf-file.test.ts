import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { pdfFileRepository, type PdfFileInsert } from '../pdf-file'

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

function makePdf(overrides?: Partial<PdfFileInsert>): PdfFileInsert {
  return {
    id: 'pdf-1',
    workspaceId: WS_ID,
    folderId: null,
    relativePath: 'test.pdf',
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
  it('pdf 없을 때 빈 배열 반환', () => {
    expect(pdfFileRepository.findByWorkspaceId(WS_ID)).toEqual([])
  })

  it('해당 workspace의 pdf만 반환 (다른 ws 제외)', () => {
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
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'p1' }))
      .run()
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'p2', workspaceId: 'ws-2', relativePath: 'other.pdf' }))
      .run()
    const result = pdfFileRepository.findByWorkspaceId(WS_ID)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
  })
})

describe('findById', () => {
  it('존재하는 id → PdfFile 반환', () => {
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'x1' }))
      .run()
    expect(pdfFileRepository.findById('x1')).toBeDefined()
  })
  it('없는 id → undefined', () => {
    expect(pdfFileRepository.findById('none')).toBeUndefined()
  })
})

describe('findByRelativePath', () => {
  it('workspaceId + relativePath 일치 → PdfFile 반환', () => {
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'rp1', relativePath: 'data/a.pdf' }))
      .run()
    const result = pdfFileRepository.findByRelativePath(WS_ID, 'data/a.pdf')
    expect(result).toBeDefined()
    expect(result!.id).toBe('rp1')
  })
  it('일치 없음 → undefined', () => {
    expect(pdfFileRepository.findByRelativePath(WS_ID, 'nope.pdf')).toBeUndefined()
  })
})

describe('create', () => {
  it('모든 필드 포함하여 생성 후 반환', () => {
    const row = pdfFileRepository.create(makePdf({ id: 'new-1', title: 'New' }))
    expect(row.id).toBe('new-1')
    expect(row.title).toBe('New')
    expect(row.description).toBe('')
    expect(row.order).toBe(0)
  })
})

describe('createMany', () => {
  it('빈 배열 → no-op', () => {
    pdfFileRepository.createMany([])
    expect(pdfFileRepository.findByWorkspaceId(WS_ID)).toEqual([])
  })

  it('여러 건 삽입 후 findByWorkspaceId로 확인', () => {
    pdfFileRepository.createMany([
      makePdf({ id: 'cm1', relativePath: 'a.pdf' }),
      makePdf({ id: 'cm2', relativePath: 'b.pdf' })
    ])
    expect(pdfFileRepository.findByWorkspaceId(WS_ID)).toHaveLength(2)
  })

  it('중복 relativePath → onConflictDoNothing (에러 없음)', () => {
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'dup1', relativePath: 'dup.pdf' }))
      .run()
    expect(() =>
      pdfFileRepository.createMany([makePdf({ id: 'dup2', relativePath: 'dup.pdf' })])
    ).not.toThrow()
    // 기존 행 유지, 새 행 무시
    expect(pdfFileRepository.findById('dup1')).toBeDefined()
    expect(pdfFileRepository.findById('dup2')).toBeUndefined()
  })
})

describe('update', () => {
  it('지정 필드만 변경, 나머지 보존', () => {
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'u1', title: '원본', description: '설명' }))
      .run()
    const updated = pdfFileRepository.update('u1', { title: '수정' })
    expect(updated?.title).toBe('수정')
    expect(updated?.description).toBe('설명')
  })
  it('없는 id → undefined', () => {
    expect(pdfFileRepository.update('ghost', { title: 'x' })).toBeUndefined()
  })
})

describe('deleteOrphans', () => {
  it('existingPaths에 없는 pdf 삭제', () => {
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'o1', relativePath: 'keep.pdf' }))
      .run()
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'o2', relativePath: 'orphan.pdf' }))
      .run()
    pdfFileRepository.deleteOrphans(WS_ID, ['keep.pdf'])
    expect(pdfFileRepository.findById('o1')).toBeDefined()
    expect(pdfFileRepository.findById('o2')).toBeUndefined()
  })

  it('existingPaths 빈 배열 → 전체 삭제', () => {
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'o3', relativePath: 'a.pdf' }))
      .run()
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'o4', relativePath: 'b.pdf' }))
      .run()
    pdfFileRepository.deleteOrphans(WS_ID, [])
    expect(pdfFileRepository.findByWorkspaceId(WS_ID)).toHaveLength(0)
  })

  it('모두 existingPaths에 있으면 삭제 없음', () => {
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'o5', relativePath: 'x.pdf' }))
      .run()
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'o6', relativePath: 'y.pdf' }))
      .run()
    pdfFileRepository.deleteOrphans(WS_ID, ['x.pdf', 'y.pdf'])
    expect(pdfFileRepository.findByWorkspaceId(WS_ID)).toHaveLength(2)
  })
})

describe('bulkDeleteByPrefix', () => {
  it('prefix 하위 pdf만 삭제, 나머지 보존', () => {
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'bp1', relativePath: 'docs/a.pdf' }))
      .run()
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'bp2', relativePath: 'docs/sub/b.pdf' }))
      .run()
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'bp3', relativePath: 'other.pdf' }))
      .run()
    pdfFileRepository.bulkDeleteByPrefix(WS_ID, 'docs')
    expect(pdfFileRepository.findById('bp1')).toBeUndefined()
    expect(pdfFileRepository.findById('bp2')).toBeUndefined()
    expect(pdfFileRepository.findById('bp3')).toBeDefined()
  })
})

describe('bulkUpdatePathPrefix', () => {
  it('정확히 oldPrefix와 일치하는 경로 → newPrefix로 변경', () => {
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'pp1', relativePath: 'old-folder' }))
      .run()
    pdfFileRepository.bulkUpdatePathPrefix(WS_ID, 'old-folder', 'new-folder')
    expect(pdfFileRepository.findById('pp1')!.relativePath).toBe('new-folder')
  })

  it('oldPrefix/ 하위 경로 → newPrefix/ 하위로 변경', () => {
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'pp2', relativePath: 'old-folder/a.pdf' }))
      .run()
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'pp3', relativePath: 'other/b.pdf' }))
      .run()
    pdfFileRepository.bulkUpdatePathPrefix(WS_ID, 'old-folder', 'new-folder')
    expect(pdfFileRepository.findById('pp2')!.relativePath).toBe('new-folder/a.pdf')
    expect(pdfFileRepository.findById('pp3')!.relativePath).toBe('other/b.pdf')
  })

  it('updatedAt 갱신 확인', () => {
    const oldDate = new Date('2020-01-01')
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'pp4', relativePath: 'old/c.pdf', updatedAt: oldDate }))
      .run()
    pdfFileRepository.bulkUpdatePathPrefix(WS_ID, 'old', 'new')
    const row = pdfFileRepository.findById('pp4')!
    expect(new Date(row.updatedAt).getTime()).toBeGreaterThan(oldDate.getTime())
  })
})

describe('reindexSiblings', () => {
  it('orderedIds 순서대로 order 재설정', () => {
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'ri1', relativePath: 'r1.pdf', order: 5 }))
      .run()
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'ri2', relativePath: 'r2.pdf', order: 3 }))
      .run()
    pdfFileRepository.reindexSiblings(WS_ID, ['ri2', 'ri1'])
    expect(pdfFileRepository.findById('ri2')!.order).toBe(0)
    expect(pdfFileRepository.findById('ri1')!.order).toBe(1)
  })
})

describe('delete', () => {
  it('삭제 후 findById → undefined', () => {
    testDb
      .insert(schema.pdfFiles)
      .values(makePdf({ id: 'd1' }))
      .run()
    pdfFileRepository.delete('d1')
    expect(pdfFileRepository.findById('d1')).toBeUndefined()
  })
})

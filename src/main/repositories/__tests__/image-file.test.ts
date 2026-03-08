import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { imageFileRepository, type ImageFileInsert } from '../image-file'

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

function makeImage(overrides?: Partial<ImageFileInsert>): ImageFileInsert {
  return {
    id: 'img-1',
    workspaceId: WS_ID,
    folderId: null,
    relativePath: 'photo.png',
    title: 'photo',
    description: '',
    preview: '',
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

describe('findByWorkspaceId', () => {
  it('image 없을 때 빈 배열 반환', () => {
    expect(imageFileRepository.findByWorkspaceId(WS_ID)).toEqual([])
  })

  it('해당 workspace의 image만 반환 (다른 ws 제외)', () => {
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
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'p1' }))
      .run()
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'p2', workspaceId: 'ws-2', relativePath: 'other.png' }))
      .run()
    const result = imageFileRepository.findByWorkspaceId(WS_ID)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
  })
})

describe('findById', () => {
  it('존재하는 id → ImageFile 반환', () => {
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'x1' }))
      .run()
    expect(imageFileRepository.findById('x1')).toBeDefined()
  })
  it('없는 id → undefined', () => {
    expect(imageFileRepository.findById('none')).toBeUndefined()
  })
})

describe('findByRelativePath', () => {
  it('workspaceId + relativePath 일치 → ImageFile 반환', () => {
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'rp1', relativePath: 'data/a.png' }))
      .run()
    const result = imageFileRepository.findByRelativePath(WS_ID, 'data/a.png')
    expect(result).toBeDefined()
    expect(result!.id).toBe('rp1')
  })
  it('일치 없음 → undefined', () => {
    expect(imageFileRepository.findByRelativePath(WS_ID, 'nope.png')).toBeUndefined()
  })
})

describe('create', () => {
  it('모든 필드 포함하여 생성 후 반환', () => {
    const row = imageFileRepository.create(makeImage({ id: 'new-1', title: 'New' }))
    expect(row.id).toBe('new-1')
    expect(row.title).toBe('New')
    expect(row.description).toBe('')
    expect(row.order).toBe(0)
  })
})

describe('createMany', () => {
  it('빈 배열 → no-op', () => {
    imageFileRepository.createMany([])
    expect(imageFileRepository.findByWorkspaceId(WS_ID)).toEqual([])
  })

  it('여러 건 삽입 후 findByWorkspaceId로 확인', () => {
    imageFileRepository.createMany([
      makeImage({ id: 'cm1', relativePath: 'a.png' }),
      makeImage({ id: 'cm2', relativePath: 'b.png' })
    ])
    expect(imageFileRepository.findByWorkspaceId(WS_ID)).toHaveLength(2)
  })

  it('중복 relativePath → onConflictDoNothing (에러 없음)', () => {
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'dup1', relativePath: 'dup.png' }))
      .run()
    expect(() =>
      imageFileRepository.createMany([makeImage({ id: 'dup2', relativePath: 'dup.png' })])
    ).not.toThrow()
    expect(imageFileRepository.findById('dup1')).toBeDefined()
    expect(imageFileRepository.findById('dup2')).toBeUndefined()
  })
})

describe('update', () => {
  it('지정 필드만 변경, 나머지 보존', () => {
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'u1', title: '원본', description: '설명' }))
      .run()
    const updated = imageFileRepository.update('u1', { title: '수정' })
    expect(updated?.title).toBe('수정')
    expect(updated?.description).toBe('설명')
  })
  it('없는 id → undefined', () => {
    expect(imageFileRepository.update('ghost', { title: 'x' })).toBeUndefined()
  })
})

describe('deleteOrphans', () => {
  it('existingPaths에 없는 image 삭제', () => {
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'o1', relativePath: 'keep.png' }))
      .run()
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'o2', relativePath: 'orphan.png' }))
      .run()
    imageFileRepository.deleteOrphans(WS_ID, ['keep.png'])
    expect(imageFileRepository.findById('o1')).toBeDefined()
    expect(imageFileRepository.findById('o2')).toBeUndefined()
  })

  it('existingPaths 빈 배열 → 전체 삭제', () => {
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'o3', relativePath: 'a.png' }))
      .run()
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'o4', relativePath: 'b.png' }))
      .run()
    imageFileRepository.deleteOrphans(WS_ID, [])
    expect(imageFileRepository.findByWorkspaceId(WS_ID)).toHaveLength(0)
  })

  it('모두 existingPaths에 있으면 삭제 없음', () => {
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'o5', relativePath: 'x.png' }))
      .run()
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'o6', relativePath: 'y.png' }))
      .run()
    imageFileRepository.deleteOrphans(WS_ID, ['x.png', 'y.png'])
    expect(imageFileRepository.findByWorkspaceId(WS_ID)).toHaveLength(2)
  })
})

describe('bulkDeleteByPrefix', () => {
  it('prefix 하위 image만 삭제, 나머지 보존', () => {
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'bp1', relativePath: 'docs/a.png' }))
      .run()
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'bp2', relativePath: 'docs/sub/b.png' }))
      .run()
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'bp3', relativePath: 'other.png' }))
      .run()
    imageFileRepository.bulkDeleteByPrefix(WS_ID, 'docs')
    expect(imageFileRepository.findById('bp1')).toBeUndefined()
    expect(imageFileRepository.findById('bp2')).toBeUndefined()
    expect(imageFileRepository.findById('bp3')).toBeDefined()
  })
})

describe('bulkUpdatePathPrefix', () => {
  it('정확히 oldPrefix와 일치하는 경로 → newPrefix로 변경', () => {
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'pp1', relativePath: 'old-folder' }))
      .run()
    imageFileRepository.bulkUpdatePathPrefix(WS_ID, 'old-folder', 'new-folder')
    expect(imageFileRepository.findById('pp1')!.relativePath).toBe('new-folder')
  })

  it('oldPrefix/ 하위 경로 → newPrefix/ 하위로 변경', () => {
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'pp2', relativePath: 'old-folder/a.png' }))
      .run()
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'pp3', relativePath: 'other/b.png' }))
      .run()
    imageFileRepository.bulkUpdatePathPrefix(WS_ID, 'old-folder', 'new-folder')
    expect(imageFileRepository.findById('pp2')!.relativePath).toBe('new-folder/a.png')
    expect(imageFileRepository.findById('pp3')!.relativePath).toBe('other/b.png')
  })

  it('updatedAt 갱신 확인', () => {
    const oldDate = new Date('2020-01-01')
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'pp4', relativePath: 'old/c.png', updatedAt: oldDate }))
      .run()
    imageFileRepository.bulkUpdatePathPrefix(WS_ID, 'old', 'new')
    const row = imageFileRepository.findById('pp4')!
    expect(new Date(row.updatedAt).getTime()).toBeGreaterThan(oldDate.getTime())
  })
})

describe('reindexSiblings', () => {
  it('orderedIds 순서대로 order 재설정', () => {
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'ri1', relativePath: 'r1.png', order: 5 }))
      .run()
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'ri2', relativePath: 'r2.png', order: 3 }))
      .run()
    imageFileRepository.reindexSiblings(WS_ID, ['ri2', 'ri1'])
    expect(imageFileRepository.findById('ri2')!.order).toBe(0)
    expect(imageFileRepository.findById('ri1')!.order).toBe(1)
  })
})

describe('delete', () => {
  it('삭제 후 findById → undefined', () => {
    testDb
      .insert(schema.imageFiles)
      .values(makeImage({ id: 'd1' }))
      .run()
    imageFileRepository.delete('d1')
    expect(imageFileRepository.findById('d1')).toBeUndefined()
  })
})

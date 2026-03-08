import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { folderRepository } from '../folder'
import type { FolderInsert } from '../folder'

// ─── Workspace FK 설정 ───────────────────────────────────────
const WS_ID = 'ws-1'

beforeEach(() => {
  testDb
    .insert(schema.workspaces)
    .values({
      id: WS_ID,
      name: 'Test Workspace',
      path: '/test/workspace',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
})

// ─── 헬퍼 ────────────────────────────────────────────────────
function makeFolder(overrides?: Partial<FolderInsert>): FolderInsert {
  return {
    id: 'folder-1',
    workspaceId: WS_ID,
    relativePath: 'a',
    color: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

// ─── findByWorkspaceId ───────────────────────────────────────
describe('findByWorkspaceId', () => {
  it('폴더가 없으면 빈 배열을 반환한다', () => {
    const result = folderRepository.findByWorkspaceId(WS_ID)
    expect(result).toEqual([])
  })

  it('여러 폴더를 반환한다', () => {
    folderRepository.create(makeFolder({ id: 'f1', relativePath: 'a' }))
    folderRepository.create(makeFolder({ id: 'f2', relativePath: 'b' }))
    const result = folderRepository.findByWorkspaceId(WS_ID)
    expect(result).toHaveLength(2)
  })
})

// ─── findById ────────────────────────────────────────────────
describe('findById', () => {
  it('존재하는 id면 폴더를 반환한다', () => {
    folderRepository.create(makeFolder({ id: 'f1' }))
    const result = folderRepository.findById('f1')
    expect(result).toBeDefined()
    expect(result?.id).toBe('f1')
  })

  it('없는 id면 undefined를 반환한다', () => {
    const result = folderRepository.findById('non-existent')
    expect(result).toBeUndefined()
  })
})

// ─── findByRelativePath ──────────────────────────────────────
describe('findByRelativePath', () => {
  it('정확히 일치하는 경로의 폴더를 반환한다', () => {
    folderRepository.create(makeFolder({ id: 'f1', relativePath: 'docs' }))
    const result = folderRepository.findByRelativePath(WS_ID, 'docs')
    expect(result?.relativePath).toBe('docs')
  })

  it('없는 경로면 undefined를 반환한다', () => {
    const result = folderRepository.findByRelativePath(WS_ID, 'missing')
    expect(result).toBeUndefined()
  })
})

// ─── create ──────────────────────────────────────────────────
describe('create', () => {
  it('폴더를 생성하고 반환한다', () => {
    const data = makeFolder({ id: 'f1', relativePath: 'src', color: '#ff0000', order: 3 })
    const result = folderRepository.create(data)
    expect(result.id).toBe('f1')
    expect(result.relativePath).toBe('src')
    expect(result.color).toBe('#ff0000')
    expect(result.order).toBe(3)
  })
})

// ─── createMany ──────────────────────────────────────────────
describe('createMany', () => {
  it('빈 배열이면 아무것도 하지 않는다', () => {
    folderRepository.createMany([])
    expect(folderRepository.findByWorkspaceId(WS_ID)).toHaveLength(0)
  })

  it('여러 항목을 일괄 insert한다', () => {
    folderRepository.createMany([
      makeFolder({ id: 'f1', relativePath: 'a' }),
      makeFolder({ id: 'f2', relativePath: 'b' }),
      makeFolder({ id: 'f3', relativePath: 'c' })
    ])
    expect(folderRepository.findByWorkspaceId(WS_ID)).toHaveLength(3)
  })
})

// ─── update ──────────────────────────────────────────────────
describe('update', () => {
  it('color를 변경한다', () => {
    folderRepository.create(makeFolder({ id: 'f1' }))
    const result = folderRepository.update('f1', { color: '#aabbcc', updatedAt: new Date() })
    expect(result?.color).toBe('#aabbcc')
  })

  it('order를 변경한다', () => {
    folderRepository.create(makeFolder({ id: 'f1', order: 0 }))
    const result = folderRepository.update('f1', { order: 5, updatedAt: new Date() })
    expect(result?.order).toBe(5)
  })

  it('없는 id면 undefined를 반환한다', () => {
    const result = folderRepository.update('ghost', { color: '#fff', updatedAt: new Date() })
    expect(result).toBeUndefined()
  })
})

// ─── bulkUpdatePathPrefix ────────────────────────────────────
describe('bulkUpdatePathPrefix', () => {
  it('"a" → "x" 로 변경 시 "a", "a/b", "a/b/c" 모두 업데이트된다', () => {
    folderRepository.createMany([
      makeFolder({ id: 'f1', relativePath: 'a' }),
      makeFolder({ id: 'f2', relativePath: 'a/b' }),
      makeFolder({ id: 'f3', relativePath: 'a/b/c' })
    ])

    folderRepository.bulkUpdatePathPrefix(WS_ID, 'a', 'x')

    const paths = folderRepository.findByWorkspaceId(WS_ID).map((f) => f.relativePath)
    expect(paths).toContain('x')
    expect(paths).toContain('x/b')
    expect(paths).toContain('x/b/c')
    expect(paths).not.toContain('a')
    expect(paths).not.toContain('a/b')
    expect(paths).not.toContain('a/b/c')
  })

  it('"ab" 경로는 prefix "a" 변경에 영향받지 않는다 (substring 경계)', () => {
    folderRepository.createMany([
      makeFolder({ id: 'f1', relativePath: 'a' }),
      makeFolder({ id: 'f2', relativePath: 'ab' })
    ])

    folderRepository.bulkUpdatePathPrefix(WS_ID, 'a', 'x')

    const paths = folderRepository.findByWorkspaceId(WS_ID).map((f) => f.relativePath)
    expect(paths).toContain('x')
    expect(paths).toContain('ab') // "ab"는 변경되지 않아야 함
  })
})

// ─── bulkDeleteByPrefix ──────────────────────────────────────
describe('bulkDeleteByPrefix', () => {
  it('prefix "a" 삭제 시 "a", "a/b", "a/b/c" 모두 삭제된다', () => {
    folderRepository.createMany([
      makeFolder({ id: 'f1', relativePath: 'a' }),
      makeFolder({ id: 'f2', relativePath: 'a/b' }),
      makeFolder({ id: 'f3', relativePath: 'a/b/c' }),
      makeFolder({ id: 'f4', relativePath: 'z' })
    ])

    folderRepository.bulkDeleteByPrefix(WS_ID, 'a')

    const paths = folderRepository.findByWorkspaceId(WS_ID).map((f) => f.relativePath)
    expect(paths).not.toContain('a')
    expect(paths).not.toContain('a/b')
    expect(paths).not.toContain('a/b/c')
    expect(paths).toContain('z') // 무관한 경로 보존
  })
})

// ─── deleteOrphans ───────────────────────────────────────────
describe('deleteOrphans', () => {
  it('existingPaths에 없는 row만 삭제한다', () => {
    folderRepository.createMany([
      makeFolder({ id: 'f1', relativePath: 'a' }),
      makeFolder({ id: 'f2', relativePath: 'a/b' }),
      makeFolder({ id: 'f3', relativePath: 'a/c' })
    ])

    // fs에는 'a', 'a/b' 만 존재 → 'a/c'가 orphan
    folderRepository.deleteOrphans(WS_ID, ['a', 'a/b'])

    const paths = folderRepository.findByWorkspaceId(WS_ID).map((f) => f.relativePath)
    expect(paths).toContain('a')
    expect(paths).toContain('a/b')
    expect(paths).not.toContain('a/c')
  })

  it('빈 배열 전달 시 워크스페이스 전체 폴더를 삭제한다 (all-delete 의도적 동작)', () => {
    folderRepository.createMany([
      makeFolder({ id: 'f1', relativePath: 'a' }),
      makeFolder({ id: 'f2', relativePath: 'b' })
    ])

    folderRepository.deleteOrphans(WS_ID, [])

    expect(folderRepository.findByWorkspaceId(WS_ID)).toHaveLength(0)
  })
})

// ─── reindexSiblings ─────────────────────────────────────────
describe('reindexSiblings', () => {
  it('orderedIds 순서대로 order 0, 1, 2를 재할당한다', () => {
    folderRepository.createMany([
      makeFolder({ id: 'id-a', relativePath: 'a', order: 2 }),
      makeFolder({ id: 'id-b', relativePath: 'b', order: 1 }),
      makeFolder({ id: 'id-c', relativePath: 'c', order: 0 })
    ])

    // c → a → b 순서로 재할당 → order: 0, 1, 2
    folderRepository.reindexSiblings(WS_ID, ['id-c', 'id-a', 'id-b'])

    const rows = folderRepository.findByWorkspaceId(WS_ID)
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.order]))
    expect(byId['id-c']).toBe(0)
    expect(byId['id-a']).toBe(1)
    expect(byId['id-b']).toBe(2)
  })

  it('빈 배열이면 DB를 변경하지 않는다 (no-op)', () => {
    folderRepository.create(makeFolder({ id: 'f1', order: 99 }))

    folderRepository.reindexSiblings(WS_ID, [])

    const row = folderRepository.findById('f1')
    expect(row?.order).toBe(99)
  })
})

// ─── delete ──────────────────────────────────────────────────
describe('delete', () => {
  it('단건 삭제 후 조회 시 undefined를 반환한다', () => {
    folderRepository.create(makeFolder({ id: 'f1' }))
    folderRepository.delete('f1')
    expect(folderRepository.findById('f1')).toBeUndefined()
  })
})

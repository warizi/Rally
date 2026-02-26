import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { noteRepository } from '../note'
import type { NoteInsert } from '../note'

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
function makeNote(overrides?: Partial<NoteInsert>): NoteInsert {
  return {
    id: 'note-1',
    workspaceId: WS_ID,
    folderId: null,
    relativePath: 'note.md',
    title: 'Note',
    description: '',
    preview: '',
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

// ─── findByWorkspaceId ───────────────────────────────────────
describe('findByWorkspaceId', () => {
  it('노트가 없으면 빈 배열을 반환한다', () => {
    expect(noteRepository.findByWorkspaceId(WS_ID)).toEqual([])
  })

  it('여러 노트를 반환한다', () => {
    noteRepository.create(makeNote({ id: 'n1', relativePath: 'a.md' }))
    noteRepository.create(makeNote({ id: 'n2', relativePath: 'b.md' }))
    expect(noteRepository.findByWorkspaceId(WS_ID)).toHaveLength(2)
  })
})

// ─── findById ────────────────────────────────────────────────
describe('findById', () => {
  it('존재하는 id면 노트를 반환한다', () => {
    noteRepository.create(makeNote({ id: 'n1' }))
    expect(noteRepository.findById('n1')?.id).toBe('n1')
  })

  it('없는 id면 undefined를 반환한다', () => {
    expect(noteRepository.findById('ghost')).toBeUndefined()
  })
})

// ─── findByRelativePath ──────────────────────────────────────
describe('findByRelativePath', () => {
  it('정확히 일치하는 경로의 노트를 반환한다', () => {
    noteRepository.create(makeNote({ id: 'n1', relativePath: 'docs/note.md' }))
    expect(noteRepository.findByRelativePath(WS_ID, 'docs/note.md')?.relativePath).toBe(
      'docs/note.md'
    )
  })

  it('없는 경로면 undefined를 반환한다', () => {
    expect(noteRepository.findByRelativePath(WS_ID, 'missing.md')).toBeUndefined()
  })
})

// ─── create ──────────────────────────────────────────────────
describe('create', () => {
  it('노트를 생성하고 반환한다 (모든 필드 검증)', () => {
    const data = makeNote({
      id: 'n1',
      relativePath: 'docs/test.md',
      title: 'Test Note',
      description: 'desc',
      preview: 'preview text',
      order: 3
    })
    const result = noteRepository.create(data)
    expect(result.id).toBe('n1')
    expect(result.relativePath).toBe('docs/test.md')
    expect(result.title).toBe('Test Note')
    expect(result.description).toBe('desc')
    expect(result.preview).toBe('preview text')
    expect(result.order).toBe(3)
    expect(result.folderId).toBeNull()
  })
})

// ─── createMany ──────────────────────────────────────────────
describe('createMany', () => {
  it('빈 배열이면 아무것도 하지 않는다', () => {
    noteRepository.createMany([])
    expect(noteRepository.findByWorkspaceId(WS_ID)).toHaveLength(0)
  })

  it('여러 항목을 일괄 insert한다', () => {
    noteRepository.createMany([
      makeNote({ id: 'n1', relativePath: 'a.md' }),
      makeNote({ id: 'n2', relativePath: 'b.md' }),
      makeNote({ id: 'n3', relativePath: 'c.md' })
    ])
    expect(noteRepository.findByWorkspaceId(WS_ID)).toHaveLength(3)
  })
})

// ─── update ──────────────────────────────────────────────────
describe('update', () => {
  it('title, description, preview 필드를 변경한다', () => {
    noteRepository.create(makeNote({ id: 'n1' }))
    const result = noteRepository.update('n1', {
      title: 'Updated',
      description: 'new desc',
      preview: 'new preview',
      updatedAt: new Date()
    })
    expect(result?.title).toBe('Updated')
    expect(result?.description).toBe('new desc')
    expect(result?.preview).toBe('new preview')
  })

  it('없는 id면 undefined를 반환한다', () => {
    expect(noteRepository.update('ghost', { title: 'x', updatedAt: new Date() })).toBeUndefined()
  })
})

// ─── deleteOrphans ───────────────────────────────────────────
describe('deleteOrphans', () => {
  it('existingPaths에 없는 row만 삭제한다', () => {
    noteRepository.createMany([
      makeNote({ id: 'n1', relativePath: 'a.md' }),
      makeNote({ id: 'n2', relativePath: 'b.md' }),
      makeNote({ id: 'n3', relativePath: 'c.md' })
    ])
    noteRepository.deleteOrphans(WS_ID, ['a.md', 'b.md'])
    const paths = noteRepository.findByWorkspaceId(WS_ID).map((n) => n.relativePath)
    expect(paths).toContain('a.md')
    expect(paths).toContain('b.md')
    expect(paths).not.toContain('c.md')
  })

  it('빈 배열 전달 시 해당 workspace 모든 note를 삭제한다', () => {
    noteRepository.createMany([
      makeNote({ id: 'n1', relativePath: 'a.md' }),
      makeNote({ id: 'n2', relativePath: 'b.md' })
    ])
    noteRepository.deleteOrphans(WS_ID, [])
    expect(noteRepository.findByWorkspaceId(WS_ID)).toHaveLength(0)
  })
})

// ─── bulkUpdatePathPrefix ────────────────────────────────────
describe('bulkUpdatePathPrefix', () => {
  it('"docs" → "archive" 변경 시 해당 prefix row를 업데이트한다', () => {
    noteRepository.createMany([
      makeNote({ id: 'n1', relativePath: 'docs/note.md' }),
      makeNote({ id: 'n2', relativePath: 'docs/sub/other.md' })
    ])
    noteRepository.bulkUpdatePathPrefix(WS_ID, 'docs', 'archive')
    const paths = noteRepository.findByWorkspaceId(WS_ID).map((n) => n.relativePath)
    expect(paths).toContain('archive/note.md')
    expect(paths).toContain('archive/sub/other.md')
    expect(paths).not.toContain('docs/note.md')
  })

  it('prefix가 완전히 일치하는 경우만 변경한다 ("doc" prefix로 "docs/note.md" 변경 안 됨)', () => {
    noteRepository.createMany([
      makeNote({ id: 'n1', relativePath: 'doc/note.md' }),
      makeNote({ id: 'n2', relativePath: 'docs/note.md' })
    ])
    noteRepository.bulkUpdatePathPrefix(WS_ID, 'doc', 'x')
    const paths = noteRepository.findByWorkspaceId(WS_ID).map((n) => n.relativePath)
    expect(paths).toContain('x/note.md')
    expect(paths).toContain('docs/note.md') // "docs/note.md"는 변경되지 않아야 함
  })
})

// ─── reindexSiblings ─────────────────────────────────────────
describe('reindexSiblings', () => {
  it('orderedIds 순서대로 order 0, 1, 2를 재할당한다', () => {
    noteRepository.createMany([
      makeNote({ id: 'n-a', relativePath: 'a.md', order: 2 }),
      makeNote({ id: 'n-b', relativePath: 'b.md', order: 1 }),
      makeNote({ id: 'n-c', relativePath: 'c.md', order: 0 })
    ])
    noteRepository.reindexSiblings(WS_ID, ['n-c', 'n-a', 'n-b'])
    const rows = noteRepository.findByWorkspaceId(WS_ID)
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.order]))
    expect(byId['n-c']).toBe(0)
    expect(byId['n-a']).toBe(1)
    expect(byId['n-b']).toBe(2)
  })

  it('빈 배열이면 DB를 변경하지 않는다 (no-op)', () => {
    noteRepository.create(makeNote({ id: 'n1', order: 99 }))
    noteRepository.reindexSiblings(WS_ID, [])
    expect(noteRepository.findById('n1')?.order).toBe(99)
  })
})

// ─── delete ──────────────────────────────────────────────────
describe('delete', () => {
  it('단건 삭제 후 조회 시 undefined를 반환한다', () => {
    noteRepository.create(makeNote({ id: 'n1' }))
    noteRepository.delete('n1')
    expect(noteRepository.findById('n1')).toBeUndefined()
  })
})

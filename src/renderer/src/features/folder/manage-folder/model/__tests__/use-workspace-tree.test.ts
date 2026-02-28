import { describe, it, expect } from 'vitest'
import { buildWorkspaceTree } from '../use-workspace-tree'
import type { FolderNode } from '@entities/folder'
import type { NoteNode } from '@entities/note'

// ─── 픽스처 헬퍼 ──────────────────────────────────────────────
function makeFolder(overrides: Partial<FolderNode> & { id: string; name: string }): FolderNode {
  return {
    relativePath: overrides.name,
    color: null,
    order: 0,
    children: [],
    ...overrides
  }
}

function makeNote(overrides: Partial<NoteNode> & { id: string; title: string }): NoteNode {
  return {
    relativePath: overrides.title,
    description: '',
    preview: '',
    folderId: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

// ─── 빈 입력 ──────────────────────────────────────────────────
describe('빈 입력', () => {
  it('폴더와 노트 모두 없으면 빈 배열을 반환한다', () => {
    expect(buildWorkspaceTree([], [], [])).toEqual([])
  })
})

// ─── 폴더만 ───────────────────────────────────────────────────
describe('폴더만 (노트 없음)', () => {
  it('단일 폴더를 FolderTreeNode로 변환한다 (toEqual 전체 검증)', () => {
    const folder = makeFolder({
      id: 'f1',
      name: 'docs',
      relativePath: 'docs',
      color: '#ff0000',
      order: 1
    })
    const result = buildWorkspaceTree([folder], [], [])

    expect(result).toEqual([
      {
        kind: 'folder',
        id: 'f1',
        name: 'docs',
        relativePath: 'docs',
        color: '#ff0000',
        order: 1,
        children: []
      }
    ])
  })

  it('중첩 폴더를 재귀 변환하여 children을 유지한다', () => {
    const child = makeFolder({ id: 'f2', name: 'components', relativePath: 'src/components' })
    const parent = makeFolder({ id: 'f1', name: 'src', relativePath: 'src', children: [child] })

    const result = buildWorkspaceTree([parent], [], [])

    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('folder')
    // @ts-expect-error children은 WorkspaceTreeNode[]
    expect(result[0].children).toHaveLength(1)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    expect(result[0].children[0]).toEqual({
      kind: 'folder',
      id: 'f2',
      name: 'components',
      relativePath: 'src/components',
      color: null,
      order: 0,
      children: []
    })
  })
})

// ─── 노트만 ───────────────────────────────────────────────────
describe('노트만 (폴더 없음)', () => {
  it('folderId=null 노트를 루트 레벨 NoteTreeNode로 변환한다 (toEqual 전체 검증)', () => {
    const note = makeNote({
      id: 'n1',
      title: 'My Note',
      relativePath: 'my-note.md',
      description: 'desc',
      preview: 'preview text',
      folderId: null,
      order: 2
    })

    const result = buildWorkspaceTree([], [note], [])

    expect(result).toEqual([
      {
        kind: 'note',
        id: 'n1',
        name: 'My Note', // title → name 변환
        relativePath: 'my-note.md',
        description: 'desc',
        preview: 'preview text',
        folderId: null,
        order: 2
      }
    ])
  })

  it('NoteNode.title이 NoteTreeNode.name으로 매핑된다', () => {
    const note = makeNote({ id: 'n1', title: 'Hello World' })
    const result = buildWorkspaceTree([], [note], [])
    expect(result[0]).toMatchObject({ name: 'Hello World' })
  })
})

// ─── 폴더 + 노트 혼합 ─────────────────────────────────────────
describe('폴더 + 노트 혼합', () => {
  it('폴더의 children 끝에 해당 folderId의 노트가 추가된다', () => {
    const folder = makeFolder({ id: 'f1', name: 'docs' })
    const note = makeNote({ id: 'n1', title: 'Readme', folderId: 'f1' })

    const result = buildWorkspaceTree([folder], [note], [])

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    expect(result[0].children).toHaveLength(1)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    expect(result[0].children[0]).toMatchObject({ kind: 'note', id: 'n1' })
  })

  it('folderId=null 루트 노트는 루트 폴더들 뒤에 추가된다', () => {
    const folder = makeFolder({ id: 'f1', name: 'docs' })
    const rootNote = makeNote({ id: 'n1', title: 'Root Note', folderId: null })

    const result = buildWorkspaceTree([folder], [rootNote], [])

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ kind: 'folder', id: 'f1' })
    expect(result[1]).toMatchObject({ kind: 'note', id: 'n1' })
  })

  it('존재하지 않는 folderId를 가진 노트는 결과에 포함되지 않는다 (drop)', () => {
    const folder = makeFolder({ id: 'f1', name: 'docs' })
    const orphanNote = makeNote({ id: 'n1', title: 'Orphan', folderId: 'non-existent-id' })

    const result = buildWorkspaceTree([folder], [orphanNote], [])

    expect(result).toHaveLength(1) // 폴더만
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    expect(result[0].children).toHaveLength(0) // 폴더 children에도 없음
  })
})

// ─── 크로스 타입 정렬 (kind 우선) ─────────────────────────────
describe('크로스 타입 정렬 (kind 우선)', () => {
  it('하위폴더(order:10)는 하위노트(order:0)보다 항상 앞에 위치한다', () => {
    const parent = makeFolder({
      id: 'p1',
      name: 'parent',
      children: [makeFolder({ id: 'f1', name: 'child-folder', order: 10 })]
    })
    const note = makeNote({ id: 'n1', title: 'child-note', folderId: 'p1', order: 0 })

    const result = buildWorkspaceTree([parent], [note], [])
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const children = result[0].children
    expect(children[0]).toMatchObject({ kind: 'folder', order: 10 })
    expect(children[1]).toMatchObject({ kind: 'note', order: 0 })
  })

  it('루트 레벨: 폴더(order:5)는 노트(order:0)보다 항상 앞에 위치한다', () => {
    const folder = makeFolder({ id: 'f1', name: 'folder', order: 5 })
    const note = makeNote({ id: 'n1', title: 'note', folderId: null, order: 0 })

    const result = buildWorkspaceTree([folder], [note], [])

    expect(result[0]).toMatchObject({ kind: 'folder', order: 5 })
    expect(result[1]).toMatchObject({ kind: 'note', order: 0 })
  })
})

// ─── within-kind 정렬 ─────────────────────────────────────────
describe('within-kind 정렬', () => {
  it('루트 폴더: order 오름차순으로 정렬된다', () => {
    const f1 = makeFolder({ id: 'f1', name: 'b-folder', order: 2 })
    const f2 = makeFolder({ id: 'f2', name: 'a-folder', order: 1 })

    const result = buildWorkspaceTree([f1, f2], [], [])

    expect(result[0]).toMatchObject({ id: 'f2', order: 1 })
    expect(result[1]).toMatchObject({ id: 'f1', order: 2 })
  })

  it('루트 폴더: 같은 order면 이름 알파벳순으로 정렬된다', () => {
    const f1 = makeFolder({ id: 'f1', name: 'zebra', order: 0 })
    const f2 = makeFolder({ id: 'f2', name: 'apple', order: 0 })

    const result = buildWorkspaceTree([f1, f2], [], [])

    expect(result[0]).toMatchObject({ id: 'f2', name: 'apple' })
    expect(result[1]).toMatchObject({ id: 'f1', name: 'zebra' })
  })

  it('루트 노트: order 오름차순으로 정렬된다', () => {
    const n1 = makeNote({ id: 'n1', title: 'b-note', order: 2 })
    const n2 = makeNote({ id: 'n2', title: 'a-note', order: 1 })

    const result = buildWorkspaceTree([], [n1, n2], [])

    expect(result[0]).toMatchObject({ id: 'n2', order: 1 })
    expect(result[1]).toMatchObject({ id: 'n1', order: 2 })
  })

  it('루트 노트: 같은 order면 title 알파벳순으로 정렬된다', () => {
    const n1 = makeNote({ id: 'n1', title: 'zebra', order: 0 })
    const n2 = makeNote({ id: 'n2', title: 'apple', order: 0 })

    const result = buildWorkspaceTree([], [n1, n2], [])

    expect(result[0]).toMatchObject({ id: 'n2', name: 'apple' })
    expect(result[1]).toMatchObject({ id: 'n1', name: 'zebra' })
  })

  it('중첩 폴더 children 내부 폴더도 동일 정렬 규칙이 적용된다', () => {
    const child1 = makeFolder({ id: 'c1', name: 'zebra', order: 0 })
    const child2 = makeFolder({ id: 'c2', name: 'apple', order: 0 })
    const parent = makeFolder({ id: 'p1', name: 'parent', children: [child1, child2] })

    const result = buildWorkspaceTree([parent], [], [])

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const children = result[0].children
    expect(children[0]).toMatchObject({ id: 'c2', name: 'apple' })
    expect(children[1]).toMatchObject({ id: 'c1', name: 'zebra' })
  })
})

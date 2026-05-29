/**
 * features/folder/manage-folder/model/use-tree-move-listener.test.ts
 *
 * 트리 노드 DnD 이동 listener. useDndMonitor 콜백 캡처 + 각 entity 의 move mutation
 * 모킹. source.kind 분기로 적절한 mutation 호출 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { DragEndEvent } from '@dnd-kit/core'

const mocks = vi.hoisted(() => ({
  moveFolder: vi.fn(),
  moveNote: vi.fn(),
  moveCsv: vi.fn(),
  movePdf: vi.fn(),
  moveImage: vi.fn(),
  tree: [
    {
      kind: 'folder',
      id: 'f-1',
      title: 'Folder',
      children: [{ kind: 'note', id: 'n-1', title: 'note' }]
    }
  ] as unknown[]
}))

const { dndCapture } = vi.hoisted(() => ({
  dndCapture: { onDragEnd: null as null | ((e: DragEndEvent) => void) }
}))

vi.mock('@dnd-kit/core', () => ({
  useDndMonitor: (handlers: { onDragEnd?: (e: DragEndEvent) => void }) => {
    dndCapture.onDragEnd = handlers.onDragEnd ?? null
  }
}))
vi.mock('@entities/folder', () => ({ useMoveFolder: () => ({ mutate: mocks.moveFolder }) }))
vi.mock('@entities/note', () => ({ useMoveNote: () => ({ mutate: mocks.moveNote }) }))
vi.mock('@entities/csv-file', () => ({ useMoveCsvFile: () => ({ mutate: mocks.moveCsv }) }))
vi.mock('@entities/pdf-file', () => ({ useMovePdfFile: () => ({ mutate: mocks.movePdf }) }))
vi.mock('@entities/image-file', () => ({ useMoveImageFile: () => ({ mutate: mocks.moveImage }) }))
vi.mock('../use-workspace-tree', () => ({
  useWorkspaceTree: () => ({ tree: mocks.tree })
}))

import { useTreeMoveListener } from '../use-tree-move-listener'

beforeEach(() => {
  Object.values(mocks)
    .filter((v) => typeof v === 'function')
    .forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockClear())
  dndCapture.onDragEnd = null
})

function fire(active: unknown, over: unknown): void {
  dndCapture.onDragEnd?.({
    active: { data: { current: active } },
    over: over ? { data: { current: over } } : null
  } as unknown as DragEndEvent)
}

function setup(workspaceId = 'ws-1'): void {
  renderHook(() => useTreeMoveListener(workspaceId))
}

describe('useTreeMoveListener — guard 분기', () => {
  it('source 없음 → 무시', () => {
    setup()
    fire(undefined, { target: 'tree-into', folderId: null })
    expect(mocks.moveNote).not.toHaveBeenCalled()
  })

  it('target 없음 → 무시', () => {
    setup()
    fire({ source: 'tree-node', kind: 'note', id: 'n', workspaceId: 'ws-1' }, undefined)
    expect(mocks.moveNote).not.toHaveBeenCalled()
  })

  it('source.source 가 tree-node 가 아니면 무시', () => {
    setup()
    fire(
      { source: 'other', kind: 'note', id: 'n', workspaceId: 'ws-1' },
      {
        target: 'tree-into',
        folderId: null
      }
    )
    expect(mocks.moveNote).not.toHaveBeenCalled()
  })

  it('다른 workspaceId 의 source → 무시', () => {
    setup('ws-1')
    fire(
      { source: 'tree-node', kind: 'note', id: 'n', workspaceId: 'ws-OTHER' },
      {
        target: 'tree-into',
        folderId: null
      }
    )
    expect(mocks.moveNote).not.toHaveBeenCalled()
  })

  it('알 수 없는 target → 무시', () => {
    setup()
    fire(
      { source: 'tree-node', kind: 'note', id: 'n', workspaceId: 'ws-1' },
      {
        target: 'unknown-target'
      }
    )
    expect(mocks.moveNote).not.toHaveBeenCalled()
  })

  it('tree-position: 자기 anchor 위 드롭 → isSelfDrop true → 무시', () => {
    setup()
    fire(
      { source: 'tree-node', kind: 'note', id: 'n-1', workspaceId: 'ws-1' },
      {
        target: 'tree-position',
        parentId: null,
        index: 0,
        anchorNodeId: 'n-1' // 자기 자신
      }
    )
    expect(mocks.moveNote).not.toHaveBeenCalled()
  })

  it('tree-into: 자기 폴더에 드롭 → 무시', () => {
    setup()
    fire(
      { source: 'tree-node', kind: 'folder', id: 'f-1', workspaceId: 'ws-1' },
      {
        target: 'tree-into',
        folderId: 'f-1'
      }
    )
    expect(mocks.moveFolder).not.toHaveBeenCalled()
  })
})

describe('useTreeMoveListener — mutation dispatch', () => {
  it('kind=folder → moveFolder', () => {
    setup()
    fire(
      { source: 'tree-node', kind: 'folder', id: 'f-x', workspaceId: 'ws-1' },
      {
        target: 'tree-into',
        folderId: null
      }
    )
    expect(mocks.moveFolder).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      folderId: 'f-x',
      parentFolderId: null,
      index: expect.any(Number)
    })
  })

  it('kind=note → moveNote', () => {
    setup()
    fire(
      { source: 'tree-node', kind: 'note', id: 'n-x', workspaceId: 'ws-1' },
      {
        target: 'tree-into',
        folderId: 'f-1'
      }
    )
    expect(mocks.moveNote).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      noteId: 'n-x',
      folderId: 'f-1',
      index: expect.any(Number)
    })
  })

  it('kind=csv → moveCsv', () => {
    setup()
    fire(
      { source: 'tree-node', kind: 'csv', id: 'c-x', workspaceId: 'ws-1' },
      {
        target: 'tree-into',
        folderId: null
      }
    )
    expect(mocks.moveCsv).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', csvId: 'c-x', folderId: null })
    )
  })

  it('kind=pdf → movePdf', () => {
    setup()
    fire(
      { source: 'tree-node', kind: 'pdf', id: 'p-x', workspaceId: 'ws-1' },
      {
        target: 'tree-into',
        folderId: null
      }
    )
    expect(mocks.movePdf).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', pdfId: 'p-x' })
    )
  })

  it('kind=image → moveImage', () => {
    setup()
    fire(
      { source: 'tree-node', kind: 'image', id: 'i-x', workspaceId: 'ws-1' },
      {
        target: 'tree-into',
        folderId: null
      }
    )
    expect(mocks.moveImage).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', imageId: 'i-x' })
    )
  })

  it('tree-position 시나리오 → 같은 dispatch 경로', () => {
    setup()
    fire(
      { source: 'tree-node', kind: 'note', id: 'n-y', workspaceId: 'ws-1' },
      {
        target: 'tree-position',
        parentId: null,
        index: 0,
        anchorNodeId: 'some-other-id'
      }
    )
    expect(mocks.moveNote).toHaveBeenCalled()
  })
})

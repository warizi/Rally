/**
 * features/folder/manage-folder/lib/tree/Tree.test.tsx
 *
 * 자체 구현 react-arborist 호환 <Tree> 컴포넌트 — virtualizer mock 으로
 * flat row 매핑 / NodeRenderer 호출 / TreeApi 노출 검증.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef, useRef } from 'react'
import { Tree } from '../Tree'
import type { TreeApi, NodeRendererProps } from '../types'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 24,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 24, key: i, size: 24 })),
    scrollToIndex: vi.fn()
  })
}))

type Node = { id: string; name: string; children?: Node[] }

function setup(
  data: Node[],
  openState: Record<string, boolean> = {},
  ref?: React.Ref<TreeApi<Node>>
): ReturnType<typeof render> {
  function Wrapper(): React.JSX.Element {
    const scrollRef = useRef<HTMLDivElement>(null)
    return (
      <div ref={scrollRef}>
        <Tree<Node>
          data={data}
          idAccessor={(n) => n.id}
          childrenAccessor={(n) => n.children ?? null}
          openState={openState}
          onToggle={vi.fn()}
          scrollElementRef={scrollRef}
          ref={ref}
        >
          {({ node, style }: NodeRendererProps<Node>) => (
            <div data-testid={`row-${node.id}`} style={style}>
              {node.data.name}
            </div>
          )}
        </Tree>
      </div>
    )
  }
  return render(<Wrapper />)
}

describe('Tree', () => {
  it('루트 노드만 (closed) → 루트만 렌더', () => {
    setup([{ id: 'a', name: 'A', children: [{ id: 'a1', name: 'A1' }] }])
    expect(screen.getByTestId('row-a')).toBeTruthy()
    expect(screen.queryByTestId('row-a1')).toBeNull()
  })

  it('루트 open → children 도 렌더', () => {
    setup([{ id: 'a', name: 'A', children: [{ id: 'a1', name: 'A1' }] }], { a: true })
    expect(screen.getByTestId('row-a')).toBeTruthy()
    expect(screen.getByTestId('row-a1')).toBeTruthy()
  })

  it('여러 루트 노드 — 순서대로 렌더', () => {
    setup([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' }
    ])
    expect(screen.getByTestId('row-a')).toBeTruthy()
    expect(screen.getByTestId('row-b')).toBeTruthy()
  })

  it('TreeApi: isOpen / scrollTo / get 노출', () => {
    const ref = createRef<TreeApi<Node>>()
    setup([{ id: 'a', name: 'A' }], { a: true }, ref)
    expect(ref.current).not.toBeNull()
    expect(ref.current!.isOpen('a')).toBe(true)
    expect(ref.current!.isOpen('not-exist')).toBe(false)
    expect(ref.current!.get('a')?.id).toBe('a')
    expect(ref.current!.get('not-exist')).toBeNull()
    expect(typeof ref.current!.scrollTo).toBe('function')
  })

  it('TreeApi: closeAll 호출 가능', () => {
    const ref = createRef<TreeApi<Node>>()
    setup([{ id: 'a', name: 'A' }], { a: true }, ref)
    expect(typeof ref.current!.closeAll).toBe('function')
  })
})

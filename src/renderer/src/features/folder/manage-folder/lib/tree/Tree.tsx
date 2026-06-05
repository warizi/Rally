import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  type ForwardedRef,
  type ReactElement,
  type Ref
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { NodeApi, NodeRendererProps, TreeApi, TreeProps } from './types'
import { flattenTree, type FlatRow } from './flatten'

// react-arborist v3 기본값과 동일하게 유지 (드롭인 호환).
const DEFAULT_ROW_HEIGHT = 24
const DEFAULT_INDENT = 24
const DEFAULT_OVERSCAN = 8

/**
 * react-arborist `<Tree>` 의 드롭인 호환 컴포넌트.
 *
 * - openState 는 외부에서 관리 (controlled). 내부 상태 없음.
 * - 행은 `@tanstack/react-virtual` 로 가상화. `scrollElementRef` 로 외부 스크롤 컨테이너 주입.
 * - NodeRenderer 에 전달하는 `node.parent` 는 루트 시 null (react-arborist 의 가상 root sentinel 대체).
 * - DnD/키보드 단축키는 의도적으로 제공하지 않음. 트리 DnD 는 @dnd-kit 으로 통일됨.
 */
function TreeInner<T>(props: TreeProps<T>, ref: ForwardedRef<TreeApi<T>>): ReactElement {
  const {
    data,
    idAccessor,
    childrenAccessor,
    openState,
    onToggle,
    rowHeight = DEFAULT_ROW_HEIGHT,
    indent = DEFAULT_INDENT,
    scrollElementRef,
    children: renderRow,
    className,
    overscan = DEFAULT_OVERSCAN
  } = props

  const flat = useMemo<FlatRow<T>[]>(
    () => flattenTree(data, idAccessor, childrenAccessor, openState),
    [data, idAccessor, childrenAccessor, openState]
  )

  // id -> flat index (TreeApi.scrollTo / get 에서 사용)
  const indexById = useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>()
    for (let i = 0; i < flat.length; i++) m.set(flat[i].id, i)
    return m
  }, [flat])

  // TanStack Virtual 의 useVirtualizer 는 memoize 할 수 없는 함수를 반환하는 라이브러리
  // 특성상 React Compiler 가 이 컴포넌트의 memoize 를 스킵한다(의도된 동작, stale UI 위험
  // 없음). 코드로 호환되게 만들 방법이 없어 해당 경고만 범위를 최소화해 억제한다.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => rowHeight,
    overscan
  })

  const makeNodeApi = useCallback(
    (row: FlatRow<T>): NodeApi<T> => {
      const isOpen = !row.isLeaf && openState[row.id] === true
      return {
        id: row.id,
        data: row.data,
        level: row.level,
        childIndex: row.childIndex,
        isOpen,
        isLeaf: row.isLeaf,
        parent: row.parentId === null ? null : { id: row.parentId },
        tree: { indent },
        toggle: () => {
          if (row.isLeaf) return
          onToggle(row.id, !isOpen)
        },
        open: () => {
          if (row.isLeaf) return
          if (isOpen) return
          onToggle(row.id, true)
        },
        close: () => {
          if (row.isLeaf) return
          if (!isOpen) return
          onToggle(row.id, false)
        }
      }
    },
    [openState, indent, onToggle]
  )

  useImperativeHandle(
    ref,
    (): TreeApi<T> => ({
      closeAll: () => {
        // openState 는 외부 관리 — Tree 내부에서는 no-op. 외부에서 reset 콜백을 호출하는 패턴.
      },
      isOpen: (id: string) => openState[id] === true,
      scrollTo: (id: string, position = 'center') => {
        const idx = indexById.get(id)
        if (idx === undefined) return
        virtualizer.scrollToIndex(idx, { align: position })
      },
      open: (id: string) => {
        if (openState[id] === true) return
        onToggle(id, true)
      },
      close: (id: string) => {
        if (openState[id] !== true) return
        onToggle(id, false)
      },
      get: (id: string) => {
        const idx = indexById.get(id)
        if (idx === undefined) return null
        return makeNodeApi(flat[idx])
      }
    }),
    [openState, indexById, virtualizer, onToggle, flat, makeNodeApi]
  )

  const totalSize = virtualizer.getTotalSize()
  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div
      data-testid="custom-tree-root"
      className={className}
      style={{ position: 'relative', width: '100%', height: totalSize }}
    >
      {virtualItems.map((vi) => {
        const row = flat[vi.index]
        if (!row) return null
        const node = makeNodeApi(row)
        const wrapperStyle = {
          position: 'absolute' as const,
          top: 0,
          left: 0,
          width: '100%',
          height: rowHeight,
          transform: `translateY(${vi.start}px)`
        }
        // NodeRenderer 에 넘기는 style 은 paddingLeft 만 담당 (수직 위치는 wrapper 가 처리).
        const rendererStyle = { paddingLeft: `${(row.level * indent) / 16}rem` }
        return (
          <div key={row.id} data-index={vi.index} style={wrapperStyle}>
            {Array.from({ length: row.level }).map((_, depth) => (
              <div
                key={depth}
                className="absolute top-0 h-full w-px bg-muted-foreground/20"
                style={{
                  left: `calc(${(depth * indent + indent) / 16}rem - 0.5rem)`
                }}
              />
            ))}
            {renderRow({ node, style: rendererStyle } as NodeRendererProps<T>)}
          </div>
        )
      })}
    </div>
  )
}

/**
 * `forwardRef` 는 제네릭을 자체적으로 보존하지 못하므로, 캐스팅으로 제네릭 시그니처를 복원한다.
 */
export const Tree = forwardRef(TreeInner) as <T>(
  props: TreeProps<T> & { ref?: Ref<TreeApi<T>> }
) => ReactElement

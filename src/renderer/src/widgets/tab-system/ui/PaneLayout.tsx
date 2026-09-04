import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react'
import { PaneContainer } from './PaneContainer'
import { LayoutNode, SplitDirection, SplitNode } from '@/entities/tab-system'
import { isPaneNode, isSplitContainerNode } from '@/entities/tab-system/model/types'
import { PaneRoute } from '@/shared/lib/pane-route'
import { useTabStore } from '@/entities/tab-system'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/shared/ui/resizable'
import { axisOfOrientation, computeMinSizePx, paneMinPx } from '../model/pane-min-size'
import { useRootFontSizePx } from '../model/use-root-font-size'

/** 레이아웃 트리에서 가장 좌상단(첫 번째) pane의 ID를 반환 */
function findTopLeftPaneId(node: LayoutNode): string | null {
  if (isPaneNode(node)) return node.paneId
  if (isSplitContainerNode(node) && node.children.length > 0) {
    return findTopLeftPaneId(node.children[0])
  }
  return null
}

interface PaneLayoutProps {
  routes: PaneRoute[]
  isDragging?: boolean
}

interface LayoutNodeRendererProps {
  node: LayoutNode
  routes: PaneRoute[]
  isDragging: boolean
  topLeftPaneId: string | null
  isTopRow: boolean
  /** 창 우측 가장자리에 접한 노드인지 — win32 캡션 버튼(WCO) 겹침 회피용 */
  isRightEdge: boolean
}

// SplitDirection를 react-resizable-panels의 orientation으로 변환
function toOrientation(direction: SplitDirection): 'horizontal' | 'vertical' {
  return direction
}

function SplitContainerRenderer({
  node,
  routes,
  isDragging,
  topLeftPaneId,
  isTopRow,
  isRightEdge
}: {
  node: SplitNode
  routes: PaneRoute[]
  isDragging: boolean
  topLeftPaneId: string | null
  isTopRow: boolean
  isRightEdge: boolean
}): React.ReactElement {
  const updateLayoutSizes = useTabStore((state) => state.updateLayoutSizes)
  const orientation = toOrientation(node.direction)
  // PaneContainer 의 min-w/h-75 는 rem 이라 글자 크기 설정에 따라 px 가 달라진다 — 같은 기준으로 환산
  const paneMin = paneMinPx(useRootFontSizePx())

  const rafRef = useRef(0)
  const nodeRef = useRef(node)
  // eslint-disable-next-line react-hooks/refs
  nodeRef.current = node

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const handleLayoutChanged = useCallback(
    (layout: { [id: string]: number }) => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const cur = nodeRef.current
        const newSizes = cur.children.map(
          (child) => layout[child.id] ?? cur.sizes[cur.children.indexOf(child)]
        )
        const hasChanged = newSizes.some((size, i) => Math.abs(size - cur.sizes[i]) > 0.01)
        if (hasChanged) {
          updateLayoutSizes(cur.id, newSizes)
        }
      })
    },
    [updateLayoutSizes]
  )

  return (
    <ResizablePanelGroup
      orientation={orientation}
      className="h-full"
      onLayoutChanged={handleLayoutChanged}
    >
      {node.children.map((child, index) => (
        <Fragment key={child.id}>
          <ResizablePanel
            id={child.id}
            defaultSize={node.sizes[index]}
            // 하위 트리가 필요로 하는 최소 크기 — 일률 300px 를 주면 안쪽이 가로 분할된 열도
            // pane 하나 기준까지 줄어들어 내부 pane 이 min-w 아래로 눌린다.
            minSize={`${computeMinSizePx(child, axisOfOrientation(orientation), paneMin)}px`}
            className="w-full"
          >
            <LayoutNodeRenderer
              node={child}
              routes={routes}
              isDragging={isDragging}
              topLeftPaneId={topLeftPaneId}
              isTopRow={orientation === 'horizontal' ? isTopRow : index === 0 && isTopRow}
              isRightEdge={
                orientation === 'horizontal'
                  ? index === node.children.length - 1 && isRightEdge
                  : isRightEdge
              }
            />
          </ResizablePanel>
          {index < node.children.length - 1 && <ResizableHandle />}
        </Fragment>
      ))}
    </ResizablePanelGroup>
  )
}

function LayoutNodeRenderer({
  node,
  routes,
  isDragging,
  topLeftPaneId,
  isTopRow,
  isRightEdge
}: LayoutNodeRendererProps): React.ReactElement {
  if (isPaneNode(node)) {
    return (
      <PaneContainer
        paneId={node.paneId}
        routes={routes}
        isDragging={isDragging}
        showSidebarTrigger={node.paneId === topLeftPaneId}
        isTopRow={isTopRow}
        isRightEdge={isRightEdge}
      />
    )
  }

  if (isSplitContainerNode(node)) {
    return (
      <SplitContainerRenderer
        node={node}
        routes={routes}
        isDragging={isDragging}
        topLeftPaneId={topLeftPaneId}
        isTopRow={isTopRow}
        isRightEdge={isRightEdge}
      />
    )
  }

  return <div className="flex-1 bg-muted" />
}

export function PaneLayout({ routes, isDragging = false }: PaneLayoutProps): React.ReactElement {
  const layout = useTabStore((state) => state.layout)
  const topLeftPaneId = useMemo(() => findTopLeftPaneId(layout), [layout])

  return (
    <div className="h-full w-full">
      <LayoutNodeRenderer
        node={layout}
        routes={routes}
        isDragging={isDragging}
        topLeftPaneId={topLeftPaneId}
        isTopRow={true}
        isRightEdge={true}
      />
    </div>
  )
}

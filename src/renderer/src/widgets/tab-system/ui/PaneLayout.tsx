import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react'
import { PaneContainer } from './PaneContainer'
import { LayoutNode, SplitDirection, SplitNode } from '@/entities/tab-system'
import {
  isPaneNode,
  isSplitContainerNode
} from '@/features/tap-system/manage-tab-system/model/types'
import { PaneRoute } from '@/shared/lib/pane-route'
import { useTabStore } from '@/features/tap-system/manage-tab-system'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/shared/ui/resizable'

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
}

// SplitDirection를 react-resizable-panels의 orientation으로 변환
function toOrientation(direction: SplitDirection): 'horizontal' | 'vertical' {
  return direction
}

function SplitContainerRenderer({
  node,
  routes,
  isDragging,
  topLeftPaneId
}: {
  node: SplitNode
  routes: PaneRoute[]
  isDragging: boolean
  topLeftPaneId: string | null
}): React.ReactElement {
  const updateLayoutSizes = useTabStore((state) => state.updateLayoutSizes)
  const orientation = toOrientation(node.direction)

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
            minSize="300px"
            className="w-full"
          >
            <LayoutNodeRenderer
              node={child}
              routes={routes}
              isDragging={isDragging}
              topLeftPaneId={topLeftPaneId}
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
  topLeftPaneId
}: LayoutNodeRendererProps): React.ReactElement {
  if (isPaneNode(node)) {
    return (
      <PaneContainer
        paneId={node.paneId}
        routes={routes}
        isDragging={isDragging}
        showSidebarTrigger={node.paneId === topLeftPaneId}
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
      />
    </div>
  )
}

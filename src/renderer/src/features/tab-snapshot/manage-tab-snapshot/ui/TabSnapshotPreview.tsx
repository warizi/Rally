import { JSX } from 'react'
import { cn } from '@shared/lib/utils'
import type { LayoutNode, Pane } from '@entities/tab-system'
import type { TabSnapshot } from '@entities/tab-snapshot'

type PaneMap = Record<string, Pane>

interface Props {
  snapshot: TabSnapshot
}

export function TabSnapshotPreview({ snapshot }: Props): JSX.Element | null {
  function renderLayoutNode(node: LayoutNode, panes: PaneMap): JSX.Element {
    if (node.type === 'pane') {
      const tabCount = panes[node.paneId]?.tabIds.length ?? 0
      return (
        <div className="relative min-h-0 min-w-0 flex-1 rounded-sm bg-muted flex items-center justify-center">
          <span className="text-[12px] text-muted-foreground leading-none ">{tabCount}</span>
        </div>
      )
    }

    const isHorizontal = node.direction === 'horizontal'
    return (
      <div
        className={cn('flex min-h-0 min-w-0 flex-1 gap-1', isHorizontal ? 'flex-row' : 'flex-col')}
      >
        {node.children.map((child, i) => (
          <div key={child.id} className="flex min-h-0 min-w-0" style={{ flex: node.sizes[i] ?? 1 }}>
            {renderLayoutNode(child, panes)}
          </div>
        ))}
      </div>
    )
  }
  try {
    const layout = JSON.parse(snapshot.layoutJson) as LayoutNode
    const panes = JSON.parse(snapshot.panesJson) as PaneMap
    return (
      // eslint-disable-next-line react-hooks/error-boundaries
      <div className="flex h-24 gap-1 rounded-sm">{renderLayoutNode(layout, panes)}</div>
    )
  } catch {
    return null
  }
}

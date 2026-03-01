import { useRef, useState, useCallback, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import type { LayoutNode, Pane } from '@entities/tab-system'
import type { LinkedEntity } from '@shared/lib/entity-link'
import { toTabOptions } from '../lib/to-tab-options'

const SUBMENU_W = 220
const SUBMENU_H = 140

interface Props {
  linked: LinkedEntity[]
  onDone: () => void
}

export function OpenAllSubmenu({ linked, onDone }: Props): React.JSX.Element {
  const layout = useTabStore((s) => s.layout)
  const panes = useTabStore((s) => s.panes)
  const openTab = useTabStore((s) => s.openTab)
  const closeTabByPathname = useTabStore((s) => s.closeTabByPathname)

  const triggerRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const handleClick = useCallback(() => {
    if (visible) {
      setVisible(false)
      return
    }
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    const fitsRight = rect.right + 4 + SUBMENU_W <= vw
    const fitsBelow = rect.top + SUBMENU_H <= vh

    setPos({
      left: fitsRight ? rect.width + 4 : -(SUBMENU_W + 1),
      top: fitsBelow ? 0 : -(SUBMENU_H - rect.height)
    })
    setVisible(true)
  }, [visible])

  useEffect(() => {
    if (!visible) return
    function handleOutsideClick(e: MouseEvent): void {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (submenuRef.current?.contains(target)) return
      setVisible(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [visible])

  function handlePaneClick(paneId: string): void {
    for (const item of linked) {
      const opts = toTabOptions(item.entityType, item.entityId, item.title)
      if (opts) {
        closeTabByPathname(opts.pathname)
        openTab(opts, paneId)
      }
    }
    onDone()
  }

  function renderLayoutNode(node: LayoutNode, paneMap: Record<string, Pane>): React.JSX.Element {
    if (node.type === 'pane') {
      const pane = paneMap[node.paneId]
      const tabCount = pane?.tabIds.length ?? 0
      return (
        <button
          type="button"
          className="relative min-h-0 min-w-0 flex-1 rounded-sm bg-muted hover:bg-primary/20 hover:ring-1 hover:ring-primary/50 flex items-center justify-center transition-colors cursor-pointer"
          onClick={() => handlePaneClick(node.paneId)}
        >
          <span className="text-[11px] text-muted-foreground leading-none">{tabCount}</span>
        </button>
      )
    }

    const isHorizontal = node.direction === 'horizontal'
    return (
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 gap-0.5',
          isHorizontal ? 'flex-row' : 'flex-col'
        )}
      >
        {node.children.map((child, i) => (
          <div key={child.id} className="flex min-h-0 min-w-0" style={{ flex: node.sizes[i] ?? 1 }}>
            {renderLayoutNode(child, paneMap)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div ref={triggerRef} className="relative">
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'flex w-full items-center gap-2 text-xs rounded px-2 py-1.5 cursor-pointer text-muted-foreground',
          visible ? 'bg-accent' : 'hover:bg-accent'
        )}
      >
        <ExternalLink className="size-3.5 shrink-0" />
        <span>모두 열기</span>
      </button>
      {visible && (
        <div ref={submenuRef} className="absolute z-50" style={{ left: pos.left, top: pos.top }}>
          <div className="w-52 rounded-md border bg-popover p-2.5 shadow-md">
            <p className="text-[10px] text-muted-foreground mb-2">탭 영역을 선택하세요</p>
            <div className="flex h-24">{renderLayoutNode(layout, panes)}</div>
          </div>
        </div>
      )}
    </div>
  )
}

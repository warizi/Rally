import { useRef, useState, useCallback, useEffect } from 'react'
import { cn } from '@shared/lib/utils'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import type { LayoutNode, Pane } from '@entities/tab-system'

const SUBMENU_W = 220
const SUBMENU_H = 140

interface PanePickerRenderProps {
  onClick: (e: React.MouseEvent) => void
  isOpen: boolean
}

interface Props {
  onPaneSelect: (paneId: string) => void
  className?: string
  children: (props: PanePickerRenderProps) => React.ReactNode
}

export function PanePickerSubmenu({
  onPaneSelect,
  className,
  children
}: Props): React.JSX.Element {
  const layout = useTabStore((s) => s.layout)
  const panes = useTabStore((s) => s.panes)

  const triggerRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
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
    },
    [visible]
  )

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
    onPaneSelect(paneId)
    setVisible(false)
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
    <div ref={triggerRef} className={cn('relative', className)}>
      {children({ onClick: handleClick, isOpen: visible })}
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

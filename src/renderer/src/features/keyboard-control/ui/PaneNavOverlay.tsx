/**
 * Pane 이동 오버레이 — ctrl + shift 활성 시 표시.
 *
 * layout 트리를 mini 박스 트리로 재귀 렌더 → active pane 만 강조.
 * 별도 store 없이 useTabStore 의 layout / activePaneId 를 직접 구독 →
 * 방향키로 active 가 바뀌면 즉시 강조도 따라간다.
 */
import { JSX } from 'react'
import { useTabStore } from '@/features/tab-system/manage-tab-system'
import { isPaneNode } from '@/features/tab-system/manage-tab-system/model/types'
import type { LayoutNode } from '@/entities/tab-system'
import { useKeyboardModeStore } from '../model/keyboard-mode-store'

function PaneBox({ isActive }: { isActive: boolean }): JSX.Element {
  return (
    <div
      className={
        'h-full w-full rounded-sm border transition-colors ' +
        (isActive
          ? 'bg-primary/30 border-primary ring-2 ring-primary/50 shadow-md'
          : 'bg-card/40 border-border/40')
      }
    />
  )
}

function LayoutMini({
  node,
  activePaneId
}: {
  node: LayoutNode
  activePaneId: string
}): JSX.Element {
  if (isPaneNode(node)) {
    return <PaneBox isActive={node.paneId === activePaneId} />
  }
  const isHorizontal = node.direction === 'horizontal'
  return (
    <div
      className={'flex gap-1 w-full h-full ' + (isHorizontal ? 'flex-row' : 'flex-col')}
    >
      {node.children.map((child, i) => (
        <div
          key={child.id}
          // flexGrow 를 sizes 비율로 → gap 이 차지하는 픽셀까지 자연스럽게
          // 흡수. flexBasis %% 합산이 100 인데 gap 까지 더해져 부모 넘침
          // (= 미니 박스 요소가 외곽선 너머로 삐져나가던 현상) 방지.
          style={{ flexGrow: node.sizes[i] ?? 1, flexBasis: 0, flexShrink: 1 }}
          className="min-w-0 min-h-0 overflow-hidden"
        >
          <LayoutMini node={child} activePaneId={activePaneId} />
        </div>
      ))}
    </div>
  )
}

export function PaneNavOverlay(): JSX.Element | null {
  const mode = useKeyboardModeStore((s) => s.mode)
  const layout = useTabStore((s) => s.layout)
  const activePaneId = useTabStore((s) => s.activePaneId)

  if (mode !== 'pane-nav') return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 backdrop-blur-sm bg-background/60 pointer-events-none"
      data-testid="pane-nav-overlay"
    >
      <div className="text-sm font-medium text-foreground/80 tracking-wide">Pane 이동</div>
      <div className="bg-card/70 border rounded-md p-4 shadow-xl">
        <div style={{ width: 360, height: 240 }}>
          <LayoutMini node={layout} activePaneId={activePaneId} />
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground tracking-wide">
        ctrl + shift 유지 + 방향키로 이동
      </div>
    </div>
  )
}

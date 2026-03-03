import { memo, useCallback, useState, useEffect } from 'react'
import { Handle, Position, NodeResizer, useStore, type NodeProps } from '@xyflow/react'
import { FileText, ExternalLink } from 'lucide-react'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { toTabOptions, PanePickerSubmenu } from '@features/entity-link/manage-link'
import type { LinkableEntityType } from '@shared/lib/entity-link'
import type { RefNode as RefNodeType } from '@entities/canvas'
import { NODE_TYPE_REGISTRY } from '../model/node-type-registry'

function RefNodeComponent({ data, selected, dragging }: NodeProps<RefNodeType>): React.JSX.Element {
  const [resizing, setResizing] = useState(false)
  const anyDragging = useStore((s) => s.nodes.some((n) => n.dragging))
  const interacting = dragging || resizing || (selected && anyDragging)
  const [mounted, setMounted] = useState(true)

  useEffect(() => {
    if (interacting) {
      const id = requestAnimationFrame(() => setMounted(false))
      return () => cancelAnimationFrame(id)
    }
    setMounted(true) // eslint-disable-line react-hooks/set-state-in-effect
    return undefined
  }, [interacting])
  const config = NODE_TYPE_REGISTRY[data.nodeType]
  const Icon = config?.icon ?? FileText
  const label = config?.label ?? data.nodeType
  const resizable = config?.resizable ?? true
  const ContentComponent = config?.component
  const isBrokenRef = !!data.refId && !data.refTitle
  const openTab = useTabStore((s) => s.openTab)
  const closeTabByPathname = useTabStore((s) => s.closeTabByPathname)

  const handleOpenInPane = useCallback(
    (paneId: string) => {
      const options = toTabOptions(
        data.nodeType as LinkableEntityType,
        data.refId ?? '',
        data.refTitle || data.nodeType
      )
      if (!options) return
      closeTabByPathname(options.pathname)
      openTab(options, paneId)
    },
    [data.nodeType, data.refId, data.refTitle, openTab, closeTabByPathname]
  )

  return (
    <>
      <NodeResizer
        minWidth={160}
        minHeight={80}
        isVisible={selected && resizable}
        lineClassName="!border-primary"
        handleClassName="!size-2 !bg-primary !border-primary"
        onResizeStart={() => setResizing(true)}
        onResizeEnd={() => setResizing(false)}
      />
      <div
        className={`rounded-lg border bg-card text-card-foreground shadow-sm h-full flex flex-col ${
          selected ? 'ring-2 ring-primary' : ''
        } ${isBrokenRef ? 'border-destructive opacity-60' : ''}`}
        style={{
          borderColor: isBrokenRef ? undefined : (data.color ?? undefined)
        }}
      >
        <Handle type="source" position={Position.Top} id="top" className="!w-2 !h-2" />
        <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2" />
        <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2 !h-2" />
        <Handle type="source" position={Position.Left} id="left" className="!w-2 !h-2" />

        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <Icon className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground flex-1 truncate">{label}</span>
          {data.refId && (
            <PanePickerSubmenu onPaneSelect={handleOpenInPane} className="nodrag shrink-0">
              {({ onClick }) => (
                <button
                  type="button"
                  className="size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  onClick={onClick}
                >
                  <ExternalLink className="size-3" />
                </button>
              )}
            </PanePickerSubmenu>
          )}
        </div>

        {ContentComponent ? (
          mounted ? (
            <div
              className={`nodrag nowheel nopan flex-1 min-h-0 flex flex-col overflow-hidden ${interacting ? 'invisible' : ''}`}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <ContentComponent
                refId={data.refId}
                refTitle={data.refTitle}
                refPreview={data.refPreview}
                refMeta={data.refMeta}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 bg-muted/40" />
          )
        ) : (
          <div className="p-3 flex-1 overflow-y-auto overflow-x-hidden nowheel">
            <p className="text-sm font-medium truncate">{data.refTitle || '(제목 없음)'}</p>
          </div>
        )}
      </div>
    </>
  )
}

export const RefNode = memo(RefNodeComponent)

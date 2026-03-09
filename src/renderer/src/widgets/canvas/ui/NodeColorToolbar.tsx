import { memo, useCallback } from 'react'
import { useStore } from '@xyflow/react'
import { Paintbrush, X } from 'lucide-react'
import type { StoreApi } from 'zustand/vanilla'
import { useUpdateCanvasNode, type CanvasNode } from '@entities/canvas'
import type { CanvasFlowState } from '../model/use-canvas-store'

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280' // gray
]

interface NodeColorToolbarProps {
  store: StoreApi<CanvasFlowState>
}

function NodeColorToolbarComponent({ store }: NodeColorToolbarProps): React.JSX.Element | null {
  const { mutate: updateNode } = useUpdateCanvasNode()

  const selectedNodes = useStore((s) => s.nodes.filter((n) => n.selected)) as CanvasNode[]
  const selectedEdgeCount = useStore((s) => s.edges.filter((e) => e.selected).length)
  const hasSelection = selectedNodes.length > 0 && selectedEdgeCount === 0

  const currentColor =
    hasSelection && selectedNodes.length === 1 ? selectedNodes[0].data.color : null

  const handleColorChange = useCallback(
    (color: string | null) => {
      // Optimistic store update for instant visual feedback
      const storeNodes = store.getState().nodes
      const selectedIds = new Set(selectedNodes.map((n) => n.id))
      store.getState().setNodes(
        storeNodes.map((node) => {
          if (!selectedIds.has(node.id)) return node
          return { ...node, data: { ...node.data, color } }
        }) as CanvasNode[]
      )

      // Persist to DB
      for (const node of selectedNodes) {
        updateNode({
          nodeId: node.id,
          data: { color: color ?? '' },
          canvasId: node.data.canvasId
        })
      }
    },
    [selectedNodes, updateNode, store]
  )

  if (!hasSelection) return null

  return (
    <div
      className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-background/90 backdrop-blur
                    border rounded-lg shadow-sm px-2.5 py-1.5"
    >
      <Paintbrush className="size-3.5 text-muted-foreground shrink-0" />
      <div className="flex items-center gap-1">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`size-5 rounded-full border-2 transition-transform hover:scale-110 ${
              currentColor === color ? 'border-foreground scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => handleColorChange(color)}
          />
        ))}
        {currentColor && (
          <button
            type="button"
            className="size-5 rounded-full border border-dashed border-muted-foreground/50
                       flex items-center justify-center hover:bg-muted transition-colors"
            onClick={() => handleColorChange(null)}
          >
            <X className="size-3 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  )
}

export const NodeColorToolbar = memo(NodeColorToolbarComponent)

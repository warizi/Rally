import { memo, useState, useCallback, useEffect } from 'react'
import { useStore, useReactFlow } from '@xyflow/react'
import {
  Minus,
  ArrowRight,
  ArrowLeftRight,
  Circle,
  X,
  Paintbrush,
  Type,
  Trash2
} from 'lucide-react'
import type { StoreApi } from 'zustand/vanilla'
import {
  useUpdateCanvasEdge,
  toReactFlowEdge,
  type CanvasEdge,
  type CanvasEdgeStyle,
  type CanvasEdgeArrow,
  type UpdateCanvasEdgeData
} from '@entities/canvas'
import type { CanvasFlowState } from '../model/use-canvas-store'

const EDGE_PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280'
]

const STYLE_OPTIONS: { value: CanvasEdgeStyle; icon: React.ReactNode; label: string }[] = [
  {
    value: 'solid',
    icon: <Minus className="size-3.5" />,
    label: '실선'
  },
  {
    value: 'dashed',
    icon: (
      <svg className="size-3.5" viewBox="0 0 16 16">
        <line
          x1="1"
          y1="8"
          x2="15"
          y2="8"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="3 2"
        />
      </svg>
    ),
    label: '점선'
  },
  {
    value: 'dotted',
    icon: (
      <svg className="size-3.5" viewBox="0 0 16 16">
        <line
          x1="1"
          y1="8"
          x2="15"
          y2="8"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="1.5 2"
        />
      </svg>
    ),
    label: '점점선'
  }
]

const ARROW_OPTIONS: { value: CanvasEdgeArrow; icon: React.ReactNode; label: string }[] = [
  { value: 'none', icon: <Circle className="size-3" />, label: '화살표 없음' },
  { value: 'end', icon: <ArrowRight className="size-3.5" />, label: '단방향' },
  { value: 'both', icon: <ArrowLeftRight className="size-3.5" />, label: '양방향' }
]

interface EdgeEditToolbarProps {
  canvasId: string
  store: StoreApi<CanvasFlowState>
}

function EdgeEditToolbarComponent({
  canvasId,
  store
}: EdgeEditToolbarProps): React.JSX.Element | null {
  const { deleteElements } = useReactFlow()
  const { mutate: updateEdge } = useUpdateCanvasEdge()

  const selectedEdges = useStore((s) => s.edges.filter((e) => e.selected)) as CanvasEdge[]
  const selectedNodeCount = useStore((s) => s.nodes.filter((n) => n.selected).length)

  const edge = selectedEdges.length === 1 && selectedNodeCount === 0 ? selectedEdges[0] : null

  const [labelInput, setLabelInput] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showLabelInput, setShowLabelInput] = useState(false)

  useEffect(() => {
    if (edge) {
      setLabelInput((edge.label as string) ?? '') // eslint-disable-line react-hooks/set-state-in-effect
      setShowColorPicker(false) // eslint-disable-line react-hooks/set-state-in-effect
      setShowLabelInput(false) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [edge?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdate = useCallback(
    (data: UpdateCanvasEdgeData) => {
      if (!edge || !edge.data) return

      // Optimistic store update for instant visual feedback
      const merged = {
        edgeStyle: data.style ?? edge.data.edgeStyle,
        arrow: data.arrow ?? edge.data.arrow,
        color: data.color !== undefined ? (data.color || null) : edge.data.color,
        fromSide: data.fromSide ?? edge.data.fromSide,
        toSide: data.toSide ?? edge.data.toSide
      }
      const freshEdge = toReactFlowEdge({
        id: edge.id,
        canvasId,
        fromNode: edge.source,
        toNode: edge.target,
        fromSide: merged.fromSide,
        toSide: merged.toSide,
        label: data.label !== undefined ? (data.label ?? null) : ((edge.label as string) ?? null),
        color: merged.color,
        style: merged.edgeStyle,
        arrow: merged.arrow,
        createdAt: new Date()
      })
      // Preserve selection state
      freshEdge.selected = true

      const storeEdges = store.getState().edges
      store
        .getState()
        .setEdges(storeEdges.map((e) => (e.id === edge.id ? freshEdge : e)) as CanvasEdge[])

      // Persist to DB
      updateEdge({ edgeId: edge.id, data, canvasId })
    },
    [edge, updateEdge, canvasId, store]
  )

  const handleLabelSubmit = useCallback(() => {
    if (!edge) return
    const newLabel = labelInput.trim()
    if (newLabel !== ((edge.label as string) ?? '')) {
      handleUpdate({ label: newLabel })
    }
    setShowLabelInput(false)
  }, [edge, labelInput, handleUpdate])

  const handleDelete = useCallback(() => {
    if (!edge) return
    deleteElements({ edges: [{ id: edge.id }] })
  }, [edge, deleteElements])

  if (!edge) return null

  const edgeData = edge.data!
  const currentStyle = edgeData.edgeStyle
  const currentArrow = edgeData.arrow
  const currentColor = edgeData.color

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10
                    bg-background/90 backdrop-blur border rounded-lg shadow-sm"
    >
      <div className="flex items-center gap-1 px-2 py-1.5">
        {/* Label toggle */}
        <button
          type="button"
          className={`size-7 rounded flex items-center justify-center transition-colors ${
            showLabelInput ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
          }`}
          title="텍스트 편집"
          onClick={() => {
            setShowLabelInput((v) => !v)
            setShowColorPicker(false)
          }}
        >
          <Type className="size-3.5" />
        </button>

        <div className="w-px h-5 bg-border" />

        {/* Style buttons */}
        {STYLE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`size-7 rounded flex items-center justify-center transition-colors ${
              currentStyle === opt.value
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted text-muted-foreground'
            }`}
            title={opt.label}
            onClick={() => handleUpdate({ style: opt.value })}
          >
            {opt.icon}
          </button>
        ))}

        <div className="w-px h-5 bg-border" />

        {/* Arrow buttons */}
        {ARROW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`size-7 rounded flex items-center justify-center transition-colors ${
              currentArrow === opt.value
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted text-muted-foreground'
            }`}
            title={opt.label}
            onClick={() => handleUpdate({ arrow: opt.value })}
          >
            {opt.icon}
          </button>
        ))}

        <div className="w-px h-5 bg-border" />

        {/* Color toggle */}
        <button
          type="button"
          className={`size-7 rounded flex items-center justify-center transition-colors ${
            showColorPicker ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
          }`}
          title="색상 변경"
          onClick={() => {
            setShowColorPicker((v) => !v)
            setShowLabelInput(false)
          }}
        >
          {currentColor ? (
            <div className="size-4 rounded-full border" style={{ backgroundColor: currentColor }} />
          ) : (
            <Paintbrush className="size-3.5 text-muted-foreground" />
          )}
        </button>

        <div className="w-px h-5 bg-border" />

        {/* Delete */}
        <button
          type="button"
          className="size-7 rounded flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
          title="삭제"
          onClick={handleDelete}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Label input row */}
      {showLabelInput && (
        <div className="flex items-center gap-1.5 px-2 pb-2">
          <input
            autoFocus
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLabelSubmit()
              if (e.key === 'Escape') setShowLabelInput(false)
              e.stopPropagation()
            }}
            onBlur={handleLabelSubmit}
            className="flex-1 h-7 px-2 text-xs bg-muted/50 border rounded outline-none
                       focus:ring-1 focus:ring-primary"
            placeholder="연결선 텍스트..."
          />
        </div>
      )}

      {/* Color picker row */}
      {showColorPicker && (
        <div className="flex items-center gap-1 px-2 pb-2">
          {EDGE_PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`size-5 rounded-full border-2 transition-transform hover:scale-110 ${
                currentColor === color ? 'border-foreground scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => handleUpdate({ color })}
            />
          ))}
          {currentColor && (
            <button
              type="button"
              className="size-5 rounded-full border border-dashed border-muted-foreground/50
                         flex items-center justify-center hover:bg-muted transition-colors"
              onClick={() => handleUpdate({ color: '' })}
            >
              <X className="size-3 text-muted-foreground" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export const EdgeEditToolbar = memo(EdgeEditToolbarComponent)

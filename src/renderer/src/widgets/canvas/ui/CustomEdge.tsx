import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps
} from '@xyflow/react'

function CustomEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style,
  markerEnd,
  markerStart,
  selected
}: EdgeProps): React.JSX.Element {
  const { deleteElements } = useReactFlow()
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  })

  const edgeStyle = selected ? { ...style, stroke: 'var(--primary)', strokeWidth: 2.5 } : style

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {selected && (
        <EdgeLabelRenderer>
          <button
            className="nodrag nopan absolute size-5 rounded-full bg-destructive/20 text-destructive
                       flex items-center justify-center text-xs pointer-events-auto hover:bg-destructive/30"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`
            }}
            onClick={() => deleteElements({ edges: [{ id }] })}
          >
            ✕
          </button>
        </EdgeLabelRenderer>
      )}
      {!selected && label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute bg-background border rounded px-2 py-0.5 text-xs pointer-events-auto"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const CustomEdge = memo(CustomEdgeComponent)

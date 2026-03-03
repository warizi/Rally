import { useState, useMemo, useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ConnectionMode,
  useReactFlow
} from '@xyflow/react'
import { TextNode } from './TextNode'
import { RefNode } from './RefNode'
import { CustomEdge } from './CustomEdge'
import { CanvasToolbar } from './CanvasToolbar'
import { EntityPickerDialog } from './EntityPickerDialog'
import { SelectionToolbar } from './SelectionToolbar'
import { NODE_TYPE_REGISTRY } from '../model/node-type-registry'
import { findNonOverlappingPosition } from '../model/canvas-layout'
import type { CanvasNodeType, CanvasNode, CanvasEdge } from '@entities/canvas'
import type { OnNodesChange, OnEdgesChange, OnConnect } from '@xyflow/react'

const NODE_TYPES = { textNode: TextNode, refNode: RefNode }
const EDGE_TYPES = { customEdge: CustomEdge }

interface CanvasBoardInnerProps {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  defaultViewport: { x: number; y: number; zoom: number }
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  saveViewport: (viewport: { x: number; y: number; zoom: number }) => void
  addTextNode: (x: number, y: number) => void
  addRefNode: (type: CanvasNodeType, refId: string, x: number, y: number) => void
}

export function CanvasBoardInner({
  nodes,
  edges,
  defaultViewport,
  onNodesChange,
  onEdgesChange,
  onConnect,
  saveViewport,
  addTextNode,
  addRefNode
}: CanvasBoardInnerProps): React.JSX.Element {
  const reactFlow = useReactFlow()
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [entityPickerOpen, setEntityPickerOpen] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)

  const nodeTypes = useMemo(() => NODE_TYPES, [])
  const edgeTypes = useMemo(() => EDGE_TYPES, [])

  // ─── Viewport (ReactFlow 의존) ────────────────────────

  const handleMoveEnd = useCallback(() => {
    const viewport = reactFlow.getViewport()
    clearTimeout(viewportTimerRef.current)
    viewportTimerRef.current = setTimeout(() => {
      saveViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom })
    }, 500)
  }, [reactFlow, saveViewport])

  // ─── Node 오케스트레이션 (ReactFlow 의존) ─────────────

  const getViewportCenter = useCallback((): { x: number; y: number } => {
    const container = document.querySelector('.react-flow')
    if (!container) return { x: 0, y: 0 }
    const rect = container.getBoundingClientRect()
    return reactFlow.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    })
  }, [reactFlow])

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!(event.target as HTMLElement).classList.contains('react-flow__pane')) return
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })
      addTextNode(position.x, position.y)
    },
    [reactFlow, addTextNode]
  )

  const handleAddText = useCallback(() => {
    const center = getViewportCenter()
    const { x, y } = findNonOverlappingPosition(nodes, center.x - 130, center.y - 80)
    addTextNode(x, y)
  }, [getViewportCenter, nodes, addTextNode])

  const handleEntitySelect = useCallback(
    (type: CanvasNodeType, refId: string) => {
      const center = getViewportCenter()
      const config = NODE_TYPE_REGISTRY[type]
      const w = config?.defaultWidth ?? 260
      const h = config?.defaultHeight ?? 160
      const { x, y } = findNonOverlappingPosition(nodes, center.x - w / 2, center.y - h / 2, w, h)
      addRefNode(type, refId, x, y)
    },
    [getViewportCenter, nodes, addRefNode]
  )

  return (
    <div className="h-full w-full relative">
      <CanvasToolbar
        onAddText={handleAddText}
        onAddEntity={() => setEntityPickerOpen(true)}
        minimap={showMinimap}
        onToggleMinimap={() => setShowMinimap((v) => !v)}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={handleMoveEnd}
        onDoubleClick={handleDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={defaultViewport}
        defaultEdgeOptions={{ type: 'customEdge' }}
        connectionMode={ConnectionMode.Loose}
        panOnDrag
        selectionOnDrag={false}
        selectionKeyCode="Meta"
        onlyRenderVisibleElements
        fitView={nodes.length > 0}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        nodeDragThreshold={5}
        connectionRadius={20}
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.1}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
        {showMinimap && <MiniMap zoomable pannable className="!bg-background !border-border" />}
      </ReactFlow>
      <SelectionToolbar />
      <EntityPickerDialog
        open={entityPickerOpen}
        onOpenChange={setEntityPickerOpen}
        onSelect={handleEntitySelect}
      />
    </div>
  )
}

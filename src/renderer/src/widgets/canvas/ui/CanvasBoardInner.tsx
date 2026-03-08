import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
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
import { useCanvasClipboard } from '../model/use-canvas-clipboard'
import type { CanvasNodeType, CanvasNode, CanvasEdge } from '@entities/canvas'
import type {
  CanvasNodeItem,
  CanvasEdgeItem,
  CreateCanvasNodeData,
  CreateCanvasEdgeData
} from '@entities/canvas'
import type { OnNodesChange, OnEdgesChange, OnConnect, NodeChange } from '@xyflow/react'

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
  canvasId: string
  createNodeAsync: (args: {
    canvasId: string
    data: CreateCanvasNodeData
  }) => Promise<CanvasNodeItem>
  createEdgeAsync: (args: {
    canvasId: string
    data: CreateCanvasEdgeData
  }) => Promise<CanvasEdgeItem>
  hasSavedViewport: boolean
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
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
  addRefNode,
  canvasId,
  createNodeAsync,
  createEdgeAsync,
  hasSavedViewport,
  undo,
  redo,
  canUndo,
  canRedo
}: CanvasBoardInnerProps): React.JSX.Element {
  const reactFlow = useReactFlow()
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [entityPickerOpen, setEntityPickerOpen] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)
  const { copy, paste, hasClipboard } = useCanvasClipboard()
  const pendingSelectionRef = useRef<string[] | null>(null)

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

  // ─── Clipboard ────────────────────────────────────────

  const handleCopy = useCallback(() => {
    const allNodes = reactFlow.getNodes() as CanvasNode[]
    const allEdges = reactFlow.getEdges() as CanvasEdge[]
    copy(allNodes, allEdges)
  }, [reactFlow, copy])

  const handlePaste = useCallback(async () => {
    if (!hasClipboard()) return
    const center = getViewportCenter()
    const newIds = await paste(canvasId, center, createNodeAsync, createEdgeAsync)
    if (newIds.length > 0) {
      pendingSelectionRef.current = newIds
    }
  }, [hasClipboard, getViewportCenter, canvasId, createNodeAsync, createEdgeAsync, paste])

  // Select pasted nodes after hydration
  useEffect(() => {
    if (!pendingSelectionRef.current) return
    const pendingIds = new Set(pendingSelectionRef.current)
    const allPresent = [...pendingIds].every((id) => nodes.some((n) => n.id === id))
    if (!allPresent) return

    pendingSelectionRef.current = null
    const changes: NodeChange[] = [
      ...nodes
        .filter((n) => n.selected)
        .map((n) => ({ type: 'select' as const, id: n.id, selected: false })),
      ...[...pendingIds].map((id) => ({ type: 'select' as const, id, selected: true }))
    ]
    onNodesChange(changes)
  }, [nodes, onNodesChange])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        const allNodes = reactFlow.getNodes() as CanvasNode[]
        const hasSelected = allNodes.some((n) => n.selected)
        if (!hasSelected) return
        const allEdges = reactFlow.getEdges() as CanvasEdge[]
        copy(allNodes, allEdges)
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault()
        handlePaste()
      }

      // Undo: Cmd+Z (without Shift)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }

      // Redo: Cmd+Shift+Z or Cmd+Y
      if ((e.metaKey || e.ctrlKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault()
        redo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [reactFlow, copy, handlePaste, undo, redo])

  return (
    <div className="h-full w-full relative">
      <CanvasToolbar
        onAddText={handleAddText}
        onAddEntity={() => setEntityPickerOpen(true)}
        minimap={showMinimap}
        onToggleMinimap={() => setShowMinimap((v) => !v)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
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
        fitView={nodes.length > 0 && !hasSavedViewport}
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
      <SelectionToolbar onCopy={handleCopy} />
      <EntityPickerDialog
        open={entityPickerOpen}
        onOpenChange={setEntityPickerOpen}
        onSelect={handleEntitySelect}
      />
    </div>
  )
}

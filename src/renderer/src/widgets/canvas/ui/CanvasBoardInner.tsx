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
import { GroupNode } from './GroupNode'
import { CustomEdge } from './CustomEdge'
import { CanvasToolbar } from './CanvasToolbar'
import { EntityPickerDialog } from './EntityPickerDialog'
import { SelectionToolbar } from './SelectionToolbar'
import { NodeColorToolbar } from './NodeColorToolbar'
import { EdgeEditToolbar } from './EdgeEditToolbar'
import { NODE_TYPE_REGISTRY } from '../model/node-type-registry'
import { findNonOverlappingPosition } from '../model/canvas-layout'
import { findGroupForNode, getContainerId, collectDescendantIds } from '../model/canvas-layout'
import { useCanvasClipboard } from '../model/use-canvas-clipboard'
import type { CanvasNodeType, CanvasFlowNode, CanvasEdge } from '@entities/canvas'
import type {
  CanvasNodeItem,
  CanvasEdgeItem,
  CreateCanvasNodeData,
  CreateCanvasEdgeData
} from '@entities/canvas'
import type { OnNodesChange, OnEdgesChange, OnConnect, NodeChange, OnNodeDrag } from '@xyflow/react'
import type { StoreApi } from 'zustand/vanilla'
import type { CanvasFlowState } from '../model/use-canvas-store'

const NODE_TYPES = { textNode: TextNode, refNode: RefNode, groupNode: GroupNode }
const EDGE_TYPES = { customEdge: CustomEdge }

interface CanvasBoardInnerProps {
  nodes: CanvasFlowNode[]
  edges: CanvasEdge[]
  defaultViewport: { x: number; y: number; zoom: number }
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  saveViewport: (viewport: { x: number; y: number; zoom: number }) => void
  addTextNode: (x: number, y: number) => void
  addRefNode: (type: CanvasNodeType, refId: string, x: number, y: number) => void
  addGroup: (x: number, y: number, width?: number, height?: number) => void
  groupSelectedNodes: () => void
  setNodeGroup: (nodeId: string, groupId: string | null) => void
  setGroupParent: (groupId: string, parentId: string | null) => void
  persistNodePositions: (updates: { id: string; x: number; y: number }[]) => void
  persistGroupPositions: (updates: { id: string; x: number; y: number }[]) => void
  canvasId: string
  createNodeAsync: (args: {
    canvasId: string
    data: CreateCanvasNodeData
  }) => Promise<CanvasNodeItem>
  createEdgeAsync: (args: {
    canvasId: string
    data: CreateCanvasEdgeData
  }) => Promise<CanvasEdgeItem>
  store: StoreApi<CanvasFlowState>
  hasSavedViewport: boolean
  pushHistory: () => void
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
  addGroup,
  groupSelectedNodes,
  setNodeGroup,
  setGroupParent,
  persistNodePositions,
  persistGroupPositions,
  canvasId,
  createNodeAsync,
  createEdgeAsync,
  store,
  hasSavedViewport,
  pushHistory,
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
  // 그룹 드래그 시작 시점 스냅샷 (그룹/멤버 시작 위치) — 멤버 동반 이동용
  const groupDragRef = useRef<{
    groupId: string
    startX: number
    startY: number
    members: { id: string; x: number; y: number; isGroup: boolean }[]
  } | null>(null)

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

  const handleAddGroup = useCallback(() => {
    const center = getViewportCenter()
    addGroup(center.x - 160, center.y - 120)
  }, [getViewportCenter, addGroup])

  // 그룹 드래그 시작 — 그룹의 전체 자손(자식 노드 + 중첩 그룹과 그 멤버) 시작 위치 스냅샷
  const handleNodeDragStart: OnNodeDrag = useCallback(
    (_event, node) => {
      if (node.type !== 'groupNode') {
        groupDragRef.current = null
        return
      }
      const all = store.getState().nodes
      const descendantIds = collectDescendantIds(all, node.id)
      const members = all.filter((n) => descendantIds.has(n.id))
      groupDragRef.current = {
        groupId: node.id,
        startX: node.position.x,
        startY: node.position.y,
        members: members.map((m) => ({
          id: m.id,
          x: m.position.x,
          y: m.position.y,
          isGroup: m.type === 'groupNode'
        }))
      }
    },
    [store]
  )

  // 그룹 드래그 중 — 멤버 노드 실시간 동반 이동 (시작 위치 + delta)
  const handleNodeDrag: OnNodeDrag = useCallback(
    (_event, node) => {
      const snap = groupDragRef.current
      if (!snap || node.id !== snap.groupId || snap.members.length === 0) return
      const dx = node.position.x - snap.startX
      const dy = node.position.y - snap.startY
      const nextPos = new Map(snap.members.map((m) => [m.id, { x: m.x + dx, y: m.y + dy }]))
      store
        .getState()
        .setNodes(
          store
            .getState()
            .nodes.map((n) => (nextPos.has(n.id) ? { ...n, position: nextPos.get(n.id)! } : n))
        )
    },
    [store]
  )

  // 노드/그룹 드래그 종료
  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node, draggedNodes) => {
      const all = store.getState().nodes
      // 그룹 드래그 종료 → 자손 위치 영속화 + 그룹 자신의 부모(중첩) 재판정
      if (node.type === 'groupNode') {
        const snap = groupDragRef.current
        groupDragRef.current = null
        if (snap && snap.groupId === node.id && snap.members.length > 0) {
          const dx = node.position.x - snap.startX
          const dy = node.position.y - snap.startY
          const moved = snap.members.map((m) => ({
            id: m.id,
            x: m.x + dx,
            y: m.y + dy,
            isGroup: m.isGroup
          }))
          persistNodePositions(
            moved.filter((m) => !m.isGroup).map(({ id, x, y }) => ({ id, x, y }))
          )
          persistGroupPositions(
            moved.filter((m) => m.isGroup).map(({ id, x, y }) => ({ id, x, y }))
          )
        }
        // 드래그한 그룹이 다른 그룹 안으로 들어갔는지/나왔는지 — 자기·자손 제외하고 판정
        const sg = all.find((n) => n.id === node.id)
        if (sg) {
          const center = {
            x: sg.position.x + sg.data.width / 2,
            y: sg.position.y + sg.data.height / 2
          }
          const exclude = new Set<string>([sg.id, ...collectDescendantIds(all, sg.id)])
          const targetParent = findGroupForNode(all, center, exclude)
          const currentParent = getContainerId(sg)
          if (targetParent !== currentParent) {
            setGroupParent(node.id, targetParent)
          }
        }
        return
      }
      // 일반 노드 드래그 종료 → 드래그된 모든 노드의 그룹 편입/이탈 판정
      // (Shift 다중선택 드래그 시 draggedNodes 에 전부 들어옴; 단일 드래그면 [node])
      const targets = (draggedNodes?.length ? draggedNodes : [node]).filter(
        (n) => n.type !== 'groupNode'
      )
      for (const dn of targets) {
        const sn = all.find((n) => n.id === dn.id)
        if (!sn || sn.type === 'groupNode') continue
        const center = {
          x: sn.position.x + sn.data.width / 2,
          y: sn.position.y + sn.data.height / 2
        }
        const targetGroupId = findGroupForNode(all, center)
        const currentGroupId = getContainerId(sn)
        if (targetGroupId !== currentGroupId) {
          setNodeGroup(dn.id, targetGroupId)
        }
      }
    },
    [store, setNodeGroup, setGroupParent, persistNodePositions, persistGroupPositions]
  )

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
    const allNodes = reactFlow.getNodes() as CanvasFlowNode[]
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
        const allNodes = reactFlow.getNodes() as CanvasFlowNode[]
        const hasSelected = allNodes.some((n) => n.selected)
        if (!hasSelected) return
        const allEdges = reactFlow.getEdges() as CanvasEdge[]
        copy(allNodes, allEdges)
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault()
        handlePaste()
      }

      // e.key 는 Shift/레이아웃에 따라 변형되므로(Cmd+Shift+Z 가 'Z'/환경별 상이) 물리 키
      // e.code 로 판정한다 — Shift 와 무관하게 'KeyZ'/'KeyY' 로 일정. (redo 미동작 안정화)
      const isZ = e.code === 'KeyZ'
      const isY = e.code === 'KeyY'

      // Undo: Cmd+Z (without Shift)
      if ((e.metaKey || e.ctrlKey) && isZ && !e.shiftKey) {
        e.preventDefault()
        undo()
      }

      // Redo: Cmd+Shift+Z or Cmd+Y
      if ((e.metaKey || e.ctrlKey) && ((isZ && e.shiftKey) || isY)) {
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
        onAddGroup={handleAddGroup}
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
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
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
      <NodeColorToolbar store={store} />
      <SelectionToolbar onCopy={handleCopy} onGroupSelection={groupSelectedNodes} />
      <EdgeEditToolbar canvasId={canvasId} store={store} pushHistory={pushHistory} />
      <EntityPickerDialog
        open={entityPickerOpen}
        onOpenChange={setEntityPickerOpen}
        onSelect={handleEntitySelect}
        canvasId={canvasId}
      />
    </div>
  )
}

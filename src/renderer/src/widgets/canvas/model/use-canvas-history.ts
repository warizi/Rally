import { useRef, useState, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import type { UseMutationResult } from '@tanstack/react-query'
import { toReactFlowNode, toReactFlowEdge } from '@entities/canvas'
import type { CanvasFlowState } from './use-canvas-store'

const MAX_HISTORY = 50

interface NodeSnapshot {
  id: string
  type: string
  refId: string | null
  x: number
  y: number
  width: number
  height: number
  color: string | null
  content: string | null
  zIndex: number
}

interface EdgeSnapshot {
  id: string
  fromNode: string
  toNode: string
  fromSide: string
  toSide: string
  label: string | null
  color: string | null
  style: string
  arrow: string
}

interface Snapshot {
  nodes: NodeSnapshot[]
  edges: EdgeSnapshot[]
}

function captureSnapshot(store: StoreApi<CanvasFlowState>): Snapshot {
  const { nodes, edges } = store.getState()
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      refId: 'refId' in n.data ? (n.data.refId ?? null) : null,
      x: n.position.x,
      y: n.position.y,
      width: n.data.width,
      height: n.data.height,
      color: n.data.color,
      content: n.data.content,
      zIndex: n.zIndex ?? 0
    })),
    edges: edges.map((e) => ({
      id: e.id,
      fromNode: e.source,
      toNode: e.target,
      fromSide: e.data?.fromSide ?? 'right',
      toSide: e.data?.toSide ?? 'left',
      label: (e.label as string) ?? null,
      color: e.data?.color ?? null,
      style: e.data?.edgeStyle ?? 'solid',
      arrow: e.data?.arrow ?? 'end'
    }))
  }
}

function restoreSnapshot(
  store: StoreApi<CanvasFlowState>,
  snapshot: Snapshot,
  canvasId: string
): void {
  store.getState().setNodes(
    snapshot.nodes.map((n) =>
      toReactFlowNode({
        id: n.id,
        canvasId,
        type: n.type as 'text' | 'todo' | 'note' | 'schedule' | 'csv' | 'pdf' | 'image',
        refId: n.refId,
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
        color: n.color,
        content: n.content,
        zIndex: n.zIndex,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    )
  )
  store.getState().setEdges(
    snapshot.edges.map((e) =>
      toReactFlowEdge({
        id: e.id,
        canvasId,
        fromNode: e.fromNode,
        toNode: e.toNode,
        fromSide: e.fromSide as 'top' | 'right' | 'bottom' | 'left',
        toSide: e.toSide as 'top' | 'right' | 'bottom' | 'left',
        label: e.label,
        color: e.color,
        style: e.style as 'solid' | 'dashed' | 'dotted',
        arrow: e.arrow as 'none' | 'end' | 'both',
        createdAt: new Date()
      })
    )
  )
}

export function useCanvasHistory(
  canvasId: string,
  store: StoreApi<CanvasFlowState>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  syncStateMutation: UseMutationResult<void, Error, any>,
  skipHydrationRef: MutableRefObject<boolean>
) {
  const historyRef = useRef<Snapshot[]>([])
  const historyIndexRef = useRef(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const updateFlags = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
  }, [])

  const initHistory = useCallback(() => {
    const snapshot = captureSnapshot(store)
    historyRef.current = [snapshot]
    historyIndexRef.current = 0
    updateFlags()
  }, [store, updateFlags])

  const pushHistory = useCallback(() => {
    const snapshot = captureSnapshot(store)
    const stack = historyRef.current.slice(0, historyIndexRef.current + 1)
    stack.push(snapshot)
    if (stack.length > MAX_HISTORY) stack.shift()
    historyRef.current = stack
    historyIndexRef.current = stack.length - 1
    updateFlags()
  }, [store, updateFlags])

  const syncToDb = useCallback(
    async (snapshot: Snapshot) => {
      skipHydrationRef.current = true
      try {
        await syncStateMutation.mutateAsync({
          canvasId,
          data: { nodes: snapshot.nodes, edges: snapshot.edges }
        })
      } finally {
        skipHydrationRef.current = false
      }
    },
    [canvasId, syncStateMutation, skipHydrationRef]
  )

  const undo = useCallback(async () => {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current -= 1
    const snapshot = historyRef.current[historyIndexRef.current]
    restoreSnapshot(store, snapshot, canvasId)
    updateFlags()
    await syncToDb(snapshot)
  }, [store, canvasId, updateFlags, syncToDb])

  const redo = useCallback(async () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current += 1
    const snapshot = historyRef.current[historyIndexRef.current]
    restoreSnapshot(store, snapshot, canvasId)
    updateFlags()
    await syncToDb(snapshot)
  }, [store, canvasId, updateFlags, syncToDb])

  return { pushHistory, undo, redo, canUndo, canRedo, initHistory }
}

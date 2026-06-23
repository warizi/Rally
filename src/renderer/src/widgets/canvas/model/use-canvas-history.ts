import { useRef, useState, useCallback, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import { useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { toReactFlowNode, toReactFlowGroupNode, toReactFlowEdge } from '@entities/canvas'
import type { CanvasFlowNode } from '@entities/canvas'
import type { CanvasFlowState } from './use-canvas-store'

const MAX_HISTORY = 50
// store 변경이 멎고 이만큼 지나면 자동 스냅샷 (연속 편집/드래그 잔여 변경 coalesce).
const AUTO_CAPTURE_DEBOUNCE_MS = 250

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
  groupId: string | null
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

interface GroupSnapshot {
  id: string
  label: string | null
  x: number
  y: number
  width: number
  height: number
  color: string | null
}

interface Snapshot {
  nodes: NodeSnapshot[]
  edges: EdgeSnapshot[]
  groups: GroupSnapshot[]
}

function captureSnapshot(store: StoreApi<CanvasFlowState>): Snapshot {
  const { nodes, edges } = store.getState()
  const groups: GroupSnapshot[] = []
  const nodeSnaps: NodeSnapshot[] = []
  for (const n of nodes) {
    if (n.type === 'groupNode') {
      groups.push({
        id: n.id,
        label: n.data.label,
        x: n.position.x,
        y: n.position.y,
        width: n.data.width,
        height: n.data.height,
        color: n.data.color
      })
    } else {
      nodeSnaps.push({
        id: n.id,
        type: n.data.nodeType,
        refId: 'refId' in n.data ? (n.data.refId ?? null) : null,
        x: n.position.x,
        y: n.position.y,
        width: n.data.width,
        height: n.data.height,
        color: n.data.color,
        content: n.data.content,
        zIndex: n.zIndex ?? 0,
        groupId: 'groupId' in n.data ? (n.data.groupId ?? null) : null
      })
    }
  }
  return {
    nodes: nodeSnaps,
    groups,
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
  const groupNodes: CanvasFlowNode[] = snapshot.groups.map((g) =>
    toReactFlowGroupNode({
      id: g.id,
      canvasId,
      label: g.label,
      x: g.x,
      y: g.y,
      width: g.width,
      height: g.height,
      color: g.color,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  )
  const flowNodes: CanvasFlowNode[] = snapshot.nodes.map((n) =>
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
      groupId: n.groupId,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  )
  store.getState().setNodes([...groupNodes, ...flowNodes])
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
): {
  pushHistory: () => void
  undo: () => Promise<void>
  redo: () => Promise<void>
  canUndo: boolean
  canRedo: boolean
  initHistory: () => void
} {
  const queryClient = useQueryClient()
  const historyRef = useRef<Snapshot[]>([])
  const historyIndexRef = useRef(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  // 마지막으로 history 에 잡힌 snapshot 의 지문 — auto-capture 가 수동 pushHistory 와
  // 중복 스냅샷을 만들지 않도록 공유한다. (null = 아직 initHistory 전)
  const lastSigRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateFlags = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
  }, [])

  const initHistory = useCallback(() => {
    const snapshot = captureSnapshot(store)
    historyRef.current = [snapshot]
    historyIndexRef.current = 0
    lastSigRef.current = JSON.stringify(snapshot)
    updateFlags()
  }, [store, updateFlags])

  const pushHistory = useCallback(() => {
    const snapshot = captureSnapshot(store)
    const stack = historyRef.current.slice(0, historyIndexRef.current + 1)
    stack.push(snapshot)
    if (stack.length > MAX_HISTORY) stack.shift()
    historyRef.current = stack
    historyIndexRef.current = stack.length - 1
    lastSigRef.current = JSON.stringify(snapshot)
    updateFlags()
  }, [store, updateFlags])

  const syncToDb = useCallback(
    async (snapshot: Snapshot) => {
      skipHydrationRef.current = true
      try {
        await syncStateMutation.mutateAsync({
          canvasId,
          data: { nodes: snapshot.nodes, edges: snapshot.edges, groups: snapshot.groups }
        })
        // 영속 완료 후, 영속 전 시작돼 진행 중이던 stale refetch 를 취소하고 최신 데이터를
        // 받아온 뒤 hydration 을 재개한다. 그렇지 않으면 지연 도착한 stale dbEdges 가
        // 방금 복원한 edge 를 덮어쓴다 (edge redo 미동작의 원인).
        const keys = [
          ['canvasNode', 'canvas', canvasId],
          ['canvasEdge', 'canvas', canvasId],
          ['canvasGroup', 'canvas', canvasId]
        ]
        await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey })))
        await Promise.all(keys.map((queryKey) => queryClient.refetchQueries({ queryKey })))
      } finally {
        skipHydrationRef.current = false
      }
    },
    [canvasId, syncStateMutation, skipHydrationRef, queryClient]
  )

  const undo = useCallback(async () => {
    if (historyIndexRef.current <= 0) return
    // 복원으로 인한 store 변경을 auto-capture 가 새 스냅샷으로 잡지 않도록 선차단.
    skipHydrationRef.current = true
    historyIndexRef.current -= 1
    const snapshot = historyRef.current[historyIndexRef.current]
    restoreSnapshot(store, snapshot, canvasId)
    lastSigRef.current = JSON.stringify(snapshot)
    updateFlags()
    await syncToDb(snapshot)
  }, [store, canvasId, updateFlags, syncToDb, skipHydrationRef])

  const redo = useCallback(async () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    skipHydrationRef.current = true
    historyIndexRef.current += 1
    const snapshot = historyRef.current[historyIndexRef.current]
    restoreSnapshot(store, snapshot, canvasId)
    lastSigRef.current = JSON.stringify(snapshot)
    updateFlags()
    await syncToDb(snapshot)
  }, [store, canvasId, updateFlags, syncToDb, skipHydrationRef])

  // ── 중앙집중 auto-capture ──
  // store 변경을 구독해, 의미 있는 변경(노드/엣지/그룹의 위치·data·구조)이 멎으면
  // 자동으로 스냅샷한다. 색/라벨/내용/엣지 속성 등 개별 편집 지점마다 pushHistory 를
  // 일일이 배선할 필요 없이 모두 history 에 잡힌다. (selection/dragging 은 지문에서 제외)
  useEffect(() => {
    const sig = (): string => JSON.stringify(captureSnapshot(store))
    const maybeCapture = (): void => {
      if (skipHydrationRef.current) return // 복원/sync 중
      if (lastSigRef.current === null) return // initHistory 전
      if (store.getState().nodes.some((n) => n.dragging)) return // 드래그 중 → 종료 후
      if (sig() === lastSigRef.current) return // 의미 변경 없음 (예: 선택만 바뀜)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        if (skipHydrationRef.current) return
        if (store.getState().nodes.some((n) => n.dragging)) return
        if (sig() === lastSigRef.current) return
        pushHistory()
      }, AUTO_CAPTURE_DEBOUNCE_MS)
    }
    const unsubscribe = store.subscribe(maybeCapture)
    return () => {
      unsubscribe()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [store, skipHydrationRef, pushHistory])

  return { pushHistory, undo, redo, canUndo, canRedo, initHistory }
}

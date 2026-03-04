import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type {
  CanvasItem,
  CanvasNodeItem,
  CanvasEdgeItem,
  CreateCanvasNodeData,
  UpdateCanvasNodeData,
  CreateCanvasEdgeData,
  UpdateCanvasEdgeData
} from './types'

const CANVAS_KEY = 'canvas'
const CANVAS_NODE_KEY = 'canvasNode'
const CANVAS_EDGE_KEY = 'canvasEdge'

// ─── Canvas Queries ──────────────────────────────────────

export function useCanvasesByWorkspace(
  workspaceId: string | null | undefined,
  search?: string
): UseQueryResult<CanvasItem[]> {
  return useQuery({
    queryKey: [CANVAS_KEY, 'workspace', workspaceId, search],
    queryFn: async (): Promise<CanvasItem[]> => {
      const options = search ? { search } : undefined
      const res: IpcResponse<CanvasItem[]> = await window.api.canvas.findByWorkspace(
        workspaceId!,
        options
      )
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId,
    placeholderData: search ? keepPreviousData : undefined
  })
}

export function useCanvasById(canvasId: string | undefined): UseQueryResult<CanvasItem> {
  return useQuery({
    queryKey: [CANVAS_KEY, 'detail', canvasId],
    queryFn: async (): Promise<CanvasItem> => {
      const res: IpcResponse<CanvasItem> = await window.api.canvas.findById(canvasId!)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    enabled: !!canvasId
  })
}

// ─── Canvas Node Queries ─────────────────────────────────

export function useCanvasNodes(canvasId: string | undefined): UseQueryResult<CanvasNodeItem[]> {
  return useQuery({
    queryKey: [CANVAS_NODE_KEY, 'canvas', canvasId],
    queryFn: async (): Promise<CanvasNodeItem[]> => {
      const res: IpcResponse<CanvasNodeItem[]> = await window.api.canvasNode.findByCanvas(canvasId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!canvasId
  })
}

// ─── Canvas Edge Queries ─────────────────────────────────

export function useCanvasEdges(canvasId: string | undefined): UseQueryResult<CanvasEdgeItem[]> {
  return useQuery({
    queryKey: [CANVAS_EDGE_KEY, 'canvas', canvasId],
    queryFn: async (): Promise<CanvasEdgeItem[]> => {
      const res: IpcResponse<CanvasEdgeItem[]> = await window.api.canvasEdge.findByCanvas(canvasId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!canvasId
  })
}

// ─── Canvas Mutations ────────────────────────────────────

export function useCreateCanvas(): UseMutationResult<
  CanvasItem,
  Error,
  { workspaceId: string; data: { title: string; description?: string } }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, data }) => {
      const res = await window.api.canvas.create(workspaceId, data)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: [CANVAS_KEY, 'workspace', workspaceId]
      })
    }
  })
}

export function useUpdateCanvas(): UseMutationResult<
  CanvasItem,
  Error,
  { canvasId: string; data: { title?: string; description?: string }; workspaceId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ canvasId, data }) => {
      const res = await window.api.canvas.update(canvasId, data)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (result, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: [CANVAS_KEY, 'workspace', workspaceId]
      })
      queryClient.setQueryData([CANVAS_KEY, 'detail', result.id], result)
    }
  })
}

export function useUpdateCanvasViewport(): UseMutationResult<
  void,
  Error,
  { canvasId: string; viewport: { x: number; y: number; zoom: number } }
> {
  return useMutation({
    mutationFn: async ({ canvasId, viewport }) => {
      const res = await window.api.canvas.updateViewport(canvasId, viewport)
      if (!res.success) throwIpcError(res)
    }
  })
}

export function useRemoveCanvas(): UseMutationResult<
  void,
  Error,
  { canvasId: string; workspaceId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ canvasId }) => {
      const res = await window.api.canvas.remove(canvasId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: [CANVAS_KEY, 'workspace', workspaceId]
      })
    }
  })
}

// ─── Canvas Node Mutations ───────────────────────────────

export function useCreateCanvasNode(): UseMutationResult<
  CanvasNodeItem,
  Error,
  { canvasId: string; data: CreateCanvasNodeData }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ canvasId, data }) => {
      const res = await window.api.canvasNode.create(canvasId, data)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (_, { canvasId }) => {
      queryClient.invalidateQueries({
        queryKey: [CANVAS_NODE_KEY, 'canvas', canvasId]
      })
    }
  })
}

export function useUpdateCanvasNode(): UseMutationResult<
  CanvasNodeItem,
  Error,
  { nodeId: string; data: UpdateCanvasNodeData; canvasId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ nodeId, data }) => {
      const res = await window.api.canvasNode.update(nodeId, data)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (_, { canvasId }) => {
      queryClient.invalidateQueries({
        queryKey: [CANVAS_NODE_KEY, 'canvas', canvasId]
      })
    }
  })
}

export function useUpdateCanvasNodePositions(): UseMutationResult<
  void,
  Error,
  { updates: { id: string; x: number; y: number }[]; canvasId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ updates }) => {
      const res = await window.api.canvasNode.updatePositions(updates)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { canvasId }) => {
      queryClient.invalidateQueries({
        queryKey: [CANVAS_NODE_KEY, 'canvas', canvasId]
      })
    }
  })
}

export function useRemoveCanvasNode(): UseMutationResult<
  void,
  Error,
  { nodeId: string; canvasId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ nodeId }) => {
      const res = await window.api.canvasNode.remove(nodeId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { canvasId }) => {
      queryClient.invalidateQueries({
        queryKey: [CANVAS_NODE_KEY, 'canvas', canvasId]
      })
      queryClient.invalidateQueries({
        queryKey: [CANVAS_EDGE_KEY, 'canvas', canvasId]
      })
    }
  })
}

// ─── Canvas Sync State Mutation ──────────────────────────

export function useSyncCanvasState(): UseMutationResult<
  void,
  Error,
  { canvasId: string; data: Parameters<typeof window.api.canvasNode.syncState>[1] }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ canvasId, data }) => {
      const res = await window.api.canvasNode.syncState(canvasId, data)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { canvasId }) => {
      queryClient.invalidateQueries({
        queryKey: [CANVAS_NODE_KEY, 'canvas', canvasId]
      })
      queryClient.invalidateQueries({
        queryKey: [CANVAS_EDGE_KEY, 'canvas', canvasId]
      })
    }
  })
}

// ─── Canvas Edge Mutations ───────────────────────────────

export function useCreateCanvasEdge(): UseMutationResult<
  CanvasEdgeItem,
  Error,
  { canvasId: string; data: CreateCanvasEdgeData }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ canvasId, data }) => {
      const res = await window.api.canvasEdge.create(canvasId, data)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (_, { canvasId }) => {
      queryClient.invalidateQueries({
        queryKey: [CANVAS_EDGE_KEY, 'canvas', canvasId]
      })
    }
  })
}

export function useUpdateCanvasEdge(): UseMutationResult<
  CanvasEdgeItem,
  Error,
  { edgeId: string; data: UpdateCanvasEdgeData; canvasId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ edgeId, data }) => {
      const res = await window.api.canvasEdge.update(edgeId, data)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (_, { canvasId }) => {
      queryClient.invalidateQueries({
        queryKey: [CANVAS_EDGE_KEY, 'canvas', canvasId]
      })
    }
  })
}

export function useRemoveCanvasEdge(): UseMutationResult<
  void,
  Error,
  { edgeId: string; canvasId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ edgeId }) => {
      const res = await window.api.canvasEdge.remove(edgeId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { canvasId }) => {
      queryClient.invalidateQueries({
        queryKey: [CANVAS_EDGE_KEY, 'canvas', canvasId]
      })
    }
  })
}

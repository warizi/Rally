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
import { useOnboardingStore } from '@shared/store/onboarding'
import { toLogError } from '@shared/lib/logger'

const onError = toLogError('onboarding')
import type {
  CanvasItem,
  CanvasNodeItem,
  CanvasEdgeItem,
  CanvasGroupItem,
  CreateCanvasNodeData,
  UpdateCanvasNodeData,
  CreateCanvasEdgeData,
  UpdateCanvasEdgeData,
  CreateCanvasGroupData,
  UpdateCanvasGroupData
} from '../model/types'

const CANVAS_KEY = 'canvas'
const CANVAS_NODE_KEY = 'canvasNode'
const CANVAS_EDGE_KEY = 'canvasEdge'
const CANVAS_GROUP_KEY = 'canvasGroup'
const HISTORY_KEY = 'history'

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

// ─── Canvas Group Queries ────────────────────────────────

export function useCanvasGroups(canvasId: string | undefined): UseQueryResult<CanvasGroupItem[]> {
  return useQuery({
    queryKey: [CANVAS_GROUP_KEY, 'canvas', canvasId],
    queryFn: async (): Promise<CanvasGroupItem[]> => {
      const res: IpcResponse<CanvasGroupItem[]> =
        await window.api.canvasGroup.findByCanvas(canvasId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!canvasId
  })
}

// ─── Canvas Group Mutations ──────────────────────────────

export function useCreateCanvasGroup(): UseMutationResult<
  CanvasGroupItem,
  Error,
  { canvasId: string; data: CreateCanvasGroupData }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ canvasId, data }) => {
      const res = await window.api.canvasGroup.create(canvasId, data)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (_, { canvasId }) => {
      queryClient.invalidateQueries({ queryKey: [CANVAS_GROUP_KEY, 'canvas', canvasId] })
    }
  })
}

export function useUpdateCanvasGroup(): UseMutationResult<
  CanvasGroupItem,
  Error,
  { groupId: string; data: UpdateCanvasGroupData; canvasId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, data }) => {
      const res = await window.api.canvasGroup.update(groupId, data)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (_, { canvasId }) => {
      queryClient.invalidateQueries({ queryKey: [CANVAS_GROUP_KEY, 'canvas', canvasId] })
    }
  })
}

export function useRemoveCanvasGroup(): UseMutationResult<
  void,
  Error,
  { groupId: string; canvasId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId }) => {
      const res = await window.api.canvasGroup.remove(groupId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { canvasId }) => {
      queryClient.invalidateQueries({ queryKey: [CANVAS_GROUP_KEY, 'canvas', canvasId] })
      // 멤버 노드의 groupId 가 풀리므로 노드 목록도 갱신
      queryClient.invalidateQueries({ queryKey: [CANVAS_NODE_KEY, 'canvas', canvasId] })
    }
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
      queryClient.invalidateQueries({ queryKey: [HISTORY_KEY, workspaceId] })
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
      queryClient.invalidateQueries({ queryKey: [HISTORY_KEY, workspaceId] })
    }
  })
}

export function useToggleCanvasLock(): UseMutationResult<
  CanvasItem,
  Error,
  { canvasId: string; isLocked: boolean; workspaceId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ canvasId, isLocked }) => {
      const res = await window.api.canvas.toggleLock(canvasId, isLocked)
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
      useOnboardingStore.getState().markChecklistStep('canvas_node').catch(onError)
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

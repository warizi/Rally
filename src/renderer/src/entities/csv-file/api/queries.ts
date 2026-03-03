import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { CsvFileNode } from '../model/types'
import { markWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { markAsOwnWrite } from '../model/own-write-tracker'

const CSV_KEY = 'csv'

export function useCsvFilesByWorkspace(workspaceId: string): UseQueryResult<CsvFileNode[]> {
  return useQuery({
    queryKey: [CSV_KEY, 'workspace', workspaceId],
    queryFn: async (): Promise<CsvFileNode[]> => {
      const res: IpcResponse<CsvFileNode[]> = await window.api.csv.readByWorkspace(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useCreateCsvFile(): UseMutationResult<
  CsvFileNode | undefined,
  Error,
  { workspaceId: string; folderId: string | null; name: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, folderId, name }) => {
      const res: IpcResponse<CsvFileNode> = await window.api.csv.create(workspaceId, folderId, name)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [CSV_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRenameCsvFile(): UseMutationResult<
  CsvFileNode | undefined,
  Error,
  { workspaceId: string; csvId: string; newName: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId, csvId }) => {
      markWorkspaceOwnWrite(workspaceId)
      markAsOwnWrite(csvId)
    },
    mutationFn: async ({ workspaceId, csvId, newName }) => {
      const res: IpcResponse<CsvFileNode> = await window.api.csv.rename(workspaceId, csvId, newName)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [CSV_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRemoveCsvFile(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; csvId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, csvId }) => {
      const res: IpcResponse<void> = await window.api.csv.remove(workspaceId, csvId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [CSV_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useReadCsvContent(
  workspaceId: string,
  csvId: string
): UseQueryResult<{ content: string; encoding: string; columnWidths: string | null }> {
  return useQuery({
    queryKey: [CSV_KEY, 'content', csvId],
    queryFn: async (): Promise<{
      content: string
      encoding: string
      columnWidths: string | null
    }> => {
      const res: IpcResponse<{
        content: string
        encoding: string
        columnWidths: string | null
      }> = await window.api.csv.readContent(workspaceId, csvId)
      if (!res.success) throwIpcError(res)
      return res.data ?? { content: '', encoding: 'UTF-8', columnWidths: null }
    },
    enabled: !!workspaceId && !!csvId,
    staleTime: Infinity
  })
}

export function useWriteCsvContent(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; csvId: string; content: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId, csvId }) => {
      markWorkspaceOwnWrite(workspaceId)
      markAsOwnWrite(csvId)
    },
    mutationFn: async ({ workspaceId, csvId, content }) => {
      const res: IpcResponse<void> = await window.api.csv.writeContent(workspaceId, csvId, content)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { csvId, content }) => {
      queryClient.setQueryData(
        [CSV_KEY, 'content', csvId],
        (old: { content: string; encoding: string; columnWidths: string | null } | undefined) => ({
          content,
          encoding: old?.encoding ?? 'UTF-8',
          columnWidths: old?.columnWidths ?? null
        })
      )
    }
  })
}

export function useMoveCsvFile(): UseMutationResult<
  CsvFileNode | undefined,
  Error,
  { workspaceId: string; csvId: string; folderId: string | null; index: number }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, csvId, folderId, index }) => {
      const res: IpcResponse<CsvFileNode> = await window.api.csv.move(
        workspaceId,
        csvId,
        folderId,
        index
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [CSV_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useUpdateCsvMeta(): UseMutationResult<
  CsvFileNode | undefined,
  Error,
  { workspaceId: string; csvId: string; data: { description?: string; columnWidths?: string } }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, csvId, data }) => {
      const res: IpcResponse<CsvFileNode> = await window.api.csv.updateMeta(
        workspaceId,
        csvId,
        data
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId, csvId, data }) => {
      queryClient.invalidateQueries({ queryKey: [CSV_KEY, 'workspace', workspaceId] })
      if (data.columnWidths !== undefined) {
        queryClient.setQueryData(
          [CSV_KEY, 'content', csvId],
          (old: { content: string; encoding: string; columnWidths: string | null } | undefined) =>
            old ? { ...old, columnWidths: data.columnWidths ?? null } : old
        )
      }
    }
  })
}

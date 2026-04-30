import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { PdfFileNode } from '../model/types'
import { markWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { markAsOwnWrite } from '../model/own-write-tracker'

const PDF_KEY = 'pdf'

export function usePdfFilesByWorkspace(workspaceId: string): UseQueryResult<PdfFileNode[]> {
  return useQuery({
    queryKey: [PDF_KEY, 'workspace', workspaceId],
    queryFn: async (): Promise<PdfFileNode[]> => {
      const res: IpcResponse<PdfFileNode[]> = await window.api.pdf.readByWorkspace(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useImportPdfFile(): UseMutationResult<
  PdfFileNode | undefined,
  Error,
  { workspaceId: string; folderId: string | null; sourcePath: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, folderId, sourcePath }) => {
      const res: IpcResponse<PdfFileNode> = await window.api.pdf.import(
        workspaceId,
        folderId,
        sourcePath
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [PDF_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useDuplicatePdfFile(): UseMutationResult<
  PdfFileNode | undefined,
  Error,
  { workspaceId: string; pdfId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, pdfId }) => {
      const res: IpcResponse<PdfFileNode> = await window.api.pdf.duplicate(workspaceId, pdfId)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [PDF_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRenamePdfFile(): UseMutationResult<
  PdfFileNode | undefined,
  Error,
  { workspaceId: string; pdfId: string; newName: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId, pdfId }) => {
      markWorkspaceOwnWrite(workspaceId)
      markAsOwnWrite(pdfId)
    },
    mutationFn: async ({ workspaceId, pdfId, newName }) => {
      const res: IpcResponse<PdfFileNode> = await window.api.pdf.rename(workspaceId, pdfId, newName)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [PDF_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRemovePdfFile(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; pdfId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, pdfId }) => {
      const res: IpcResponse<void> = await window.api.pdf.remove(workspaceId, pdfId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [PDF_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useReadPdfContent(
  workspaceId: string,
  pdfId: string
): UseQueryResult<{ data: ArrayBuffer }> {
  return useQuery({
    queryKey: [PDF_KEY, 'content', pdfId],
    queryFn: async (): Promise<{ data: ArrayBuffer }> => {
      const res: IpcResponse<{ data: ArrayBuffer }> = await window.api.pdf.readContent(
        workspaceId,
        pdfId
      )
      if (!res.success) throwIpcError(res)
      return res.data ?? { data: new ArrayBuffer(0) }
    },
    enabled: !!workspaceId && !!pdfId,
    staleTime: Infinity
  })
}

export function useMovePdfFile(): UseMutationResult<
  PdfFileNode | undefined,
  Error,
  { workspaceId: string; pdfId: string; folderId: string | null; index: number }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, pdfId, folderId, index }) => {
      const res: IpcResponse<PdfFileNode> = await window.api.pdf.move(
        workspaceId,
        pdfId,
        folderId,
        index
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      // 백엔드 move는 reindexLeafSiblings로 모든 leaf 종류 order 갱신 → 모두 invalidate
      queryClient.invalidateQueries({ queryKey: ['note', 'workspace', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['csv', 'workspace', workspaceId] })
      queryClient.invalidateQueries({ queryKey: [PDF_KEY, 'workspace', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['image', 'workspace', workspaceId] })
    }
  })
}

export function useUpdatePdfMeta(): UseMutationResult<
  PdfFileNode | undefined,
  Error,
  { workspaceId: string; pdfId: string; data: { description?: string } }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, pdfId, data }) => {
      const res: IpcResponse<PdfFileNode> = await window.api.pdf.updateMeta(
        workspaceId,
        pdfId,
        data
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [PDF_KEY, 'workspace', workspaceId] })
    }
  })
}

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { NoteNode } from '../model/types'
import { markWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { markAsOwnWrite } from '../model/own-write-tracker'

const NOTE_KEY = 'note'

export function useNotesByWorkspace(workspaceId: string): UseQueryResult<NoteNode[]> {
  return useQuery({
    queryKey: [NOTE_KEY, 'workspace', workspaceId],
    queryFn: async (): Promise<NoteNode[]> => {
      const res: IpcResponse<NoteNode[]> = await window.api.note.readByWorkspace(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useCreateNote(): UseMutationResult<
  NoteNode | undefined,
  Error,
  { workspaceId: string; folderId: string | null; name: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, folderId, name }) => {
      const res: IpcResponse<NoteNode> = await window.api.note.create(workspaceId, folderId, name)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [NOTE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRenameNote(): UseMutationResult<
  NoteNode | undefined,
  Error,
  { workspaceId: string; noteId: string; newName: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId, noteId }) => {
      markWorkspaceOwnWrite(workspaceId)
      markAsOwnWrite(noteId)
    },
    mutationFn: async ({ workspaceId, noteId, newName }) => {
      const res: IpcResponse<NoteNode> = await window.api.note.rename(workspaceId, noteId, newName)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [NOTE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRemoveNote(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; noteId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, noteId }) => {
      const res: IpcResponse<void> = await window.api.note.remove(workspaceId, noteId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [NOTE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useReadNoteContent(workspaceId: string, noteId: string): UseQueryResult<string> {
  return useQuery({
    queryKey: [NOTE_KEY, 'content', noteId],
    queryFn: async (): Promise<string> => {
      const res: IpcResponse<string> = await window.api.note.readContent(workspaceId, noteId)
      if (!res.success) throwIpcError(res)
      return res.data ?? ''
    },
    enabled: !!workspaceId && !!noteId,
    staleTime: Infinity // 편집 중 React Query 자동 refetch로 내용 덮어쓰기 방지
  })
}

export function useWriteNoteContent(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; noteId: string; content: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId, noteId }) => {
      markWorkspaceOwnWrite(workspaceId)
      // 파일 쓰기 전에 미리 표시 → watcher 이벤트 수신 시 자체 저장으로 식별
      markAsOwnWrite(noteId)
    },
    mutationFn: async ({ workspaceId, noteId, content }) => {
      const res: IpcResponse<void> = await window.api.note.writeContent(
        workspaceId,
        noteId,
        content
      )
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { noteId, content }) => {
      // 캐시를 최신 내용으로 동기화 → 재오픈 시 빈 화면 방지
      queryClient.setQueryData([NOTE_KEY, 'content', noteId], content)
    }
  })
}

export function useMoveNote(): UseMutationResult<
  NoteNode | undefined,
  Error,
  { workspaceId: string; noteId: string; folderId: string | null; index: number }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, noteId, folderId, index }) => {
      const res: IpcResponse<NoteNode> = await window.api.note.move(
        workspaceId,
        noteId,
        folderId,
        index
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [NOTE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useUpdateNoteMeta(): UseMutationResult<
  NoteNode | undefined,
  Error,
  { workspaceId: string; noteId: string; data: { description?: string } }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, noteId, data }) => {
      const res: IpcResponse<NoteNode> = await window.api.note.updateMeta(workspaceId, noteId, data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [NOTE_KEY, 'workspace', workspaceId] })
    }
  })
}

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { Template, TemplateType } from '../model/types'

const TEMPLATE_KEY = 'template'

export function useTemplates(workspaceId: string, type: TemplateType): UseQueryResult<Template[]> {
  return useQuery({
    queryKey: [TEMPLATE_KEY, 'list', workspaceId, type],
    queryFn: async (): Promise<Template[]> => {
      const res: IpcResponse<Template[]> = await window.api.template.list(workspaceId, type)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useCreateTemplate(): UseMutationResult<
  Template | undefined,
  Error,
  { workspaceId: string; title: string; type: TemplateType; jsonData: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input) => {
      const res: IpcResponse<Template> = await window.api.template.create(input)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId, type }) => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATE_KEY, 'list', workspaceId, type] })
    }
  })
}

export function useDeleteTemplate(): UseMutationResult<
  void,
  Error,
  { id: string; workspaceId: string; type: TemplateType }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }) => {
      const res: IpcResponse<void> = await window.api.template.delete(id)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId, type }) => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATE_KEY, 'list', workspaceId, type] })
    }
  })
}

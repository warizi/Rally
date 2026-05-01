import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { LinkableEntityType, LinkedEntity } from '@shared/lib/entity-link'

export const ENTITY_LINK_KEY = 'entityLink'
const HISTORY_KEY = 'history'

export function useLinkedEntities(
  entityType: LinkableEntityType,
  entityId: string | undefined
): UseQueryResult<LinkedEntity[]> {
  return useQuery({
    queryKey: [ENTITY_LINK_KEY, entityType, entityId],
    queryFn: async (): Promise<LinkedEntity[]> => {
      const res: IpcResponse<LinkedEntity[]> = await window.api.entityLink.getLinked(
        entityType,
        entityId!
      )
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!entityId
  })
}

export function useLinkEntity(): UseMutationResult<
  void,
  Error,
  {
    typeA: LinkableEntityType
    idA: string
    typeB: LinkableEntityType
    idB: string
    workspaceId: string
  }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ typeA, idA, typeB, idB, workspaceId }) => {
      const res = await window.api.entityLink.link(typeA, idA, typeB, idB, workspaceId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { typeA, idA, typeB, idB, workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [ENTITY_LINK_KEY, typeA, idA] })
      queryClient.invalidateQueries({ queryKey: [ENTITY_LINK_KEY, typeB, idB] })
      // todo↔다른 엔티티 연결 변경 시 히스토리도 갱신
      queryClient.invalidateQueries({ queryKey: [HISTORY_KEY, workspaceId] })
    }
  })
}

export function useUnlinkEntity(): UseMutationResult<
  void,
  Error,
  {
    typeA: LinkableEntityType
    idA: string
    typeB: LinkableEntityType
    idB: string
  }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ typeA, idA, typeB, idB }) => {
      const res = await window.api.entityLink.unlink(typeA, idA, typeB, idB)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { typeA, idA, typeB, idB }) => {
      queryClient.invalidateQueries({ queryKey: [ENTITY_LINK_KEY, typeA, idA] })
      queryClient.invalidateQueries({ queryKey: [ENTITY_LINK_KEY, typeB, idB] })
      // workspaceId가 인자에 없어 모든 워크스페이스 히스토리 무효화 (드물게 발생)
      queryClient.invalidateQueries({ queryKey: [HISTORY_KEY] })
    }
  })
}

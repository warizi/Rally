import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type {
  CreateCustomSkillInput,
  SkillApplyStatus,
  SkillItem,
  UpdateCustomSkillInput
} from '../model/types'

const SKILL_KEY = 'skill'

export function useSkills(): UseQueryResult<SkillItem[]> {
  return useQuery({
    queryKey: [SKILL_KEY, 'list'],
    queryFn: async (): Promise<SkillItem[]> => {
      const res: IpcResponse<SkillItem[]> = await window.api.skill.list()
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    }
  })
}

export function useSkillStatus(): UseQueryResult<SkillApplyStatus[]> {
  return useQuery({
    queryKey: [SKILL_KEY, 'status'],
    queryFn: async (): Promise<SkillApplyStatus[]> => {
      const res: IpcResponse<SkillApplyStatus[]> = await window.api.skill.status()
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    }
  })
}

export function useCreateSkill(): UseMutationResult<
  SkillItem | undefined,
  Error,
  CreateCustomSkillInput
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input) => {
      const res: IpcResponse<SkillItem> = await window.api.skill.create(input)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SKILL_KEY] })
    }
  })
}

export function useUpdateSkill(): UseMutationResult<
  SkillItem | undefined,
  Error,
  { id: string; input: UpdateCustomSkillInput }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }) => {
      const res: IpcResponse<SkillItem> = await window.api.skill.update(id, input)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SKILL_KEY] })
    }
  })
}

export function useRemoveSkill(): UseMutationResult<
  { batchId: string } | undefined,
  Error,
  { workspaceId: string; id: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, id }) => {
      const res: IpcResponse<{ batchId: string }> = await window.api.skill.remove(workspaceId, id)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: () => {
      // skill 목록뿐 아니라 trash 목록도 갱신.
      qc.invalidateQueries({ queryKey: [SKILL_KEY] })
      qc.invalidateQueries({ queryKey: ['trash'] })
    }
  })
}

export function useResetSystemSkill(): UseMutationResult<
  SkillItem | undefined,
  Error,
  { id: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }) => {
      const res: IpcResponse<SkillItem> = await window.api.skill.resetSystem(id)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SKILL_KEY] })
    }
  })
}

export function useApplySkill(): UseMutationResult<
  SkillApplyStatus | undefined,
  Error,
  { id: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }) => {
      const res: IpcResponse<SkillApplyStatus> = await window.api.skill.apply(id)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SKILL_KEY, 'status'] })
    }
  })
}

export function useUnapplySkill(): UseMutationResult<
  SkillApplyStatus | undefined,
  Error,
  { id: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }) => {
      const res: IpcResponse<SkillApplyStatus> = await window.api.skill.unapply(id)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SKILL_KEY, 'status'] })
    }
  })
}

/**
 * entities/skill/api/queries.test.ts
 *
 * skill 8개 hook (useSkills, useSkillStatus, useCreate/Update/Remove/ResetSystem/Apply/Unapply).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import {
  useSkills,
  useSkillStatus,
  useCreateSkill,
  useUpdateSkill,
  useRemoveSkill,
  useResetSystemSkill,
  useApplySkill,
  useUnapplySkill
} from '../queries'
import type { SkillItem, SkillApplyStatus } from '../../model/types'

const SKILL = {
  id: 'sk-1',
  name: 'my-skill',
  type: 'custom',
  description: '',
  content: '# SKILL'
} as unknown as SkillItem

const STATUS = {
  id: 'sk-1',
  name: 'my-skill',
  applied: { claude: true, codex: false }
} as unknown as SkillApplyStatus

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    skill: {
      list: vi.fn(),
      status: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      resetSystem: vi.fn(),
      apply: vi.fn(),
      unapply: vi.fn()
    }
  }
  vi.clearAllMocks()
})

function makeWrapper(): {
  wrapper: ({ children }: { children: ReactNode }) => ReactElement
  qc: QueryClient
} {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }): ReactElement =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

function api(): typeof window.api {
  return (window as unknown as { api: typeof window.api }).api
}

describe('useSkills / useSkillStatus', () => {
  it('useSkills → list 결과 반환', async () => {
    vi.mocked(api().skill.list).mockResolvedValue({ success: true, data: [SKILL] })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSkills(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([SKILL])
  })

  it('useSkillStatus → status 결과 반환', async () => {
    vi.mocked(api().skill.status).mockResolvedValue({ success: true, data: [STATUS] })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSkillStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([STATUS])
  })

  it('IPC 실패 → isError', async () => {
    vi.mocked(api().skill.list).mockResolvedValue({
      success: false,
      errorType: 'UnknownError',
      message: 'x'
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSkills(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCreateSkill / useUpdateSkill', () => {
  it('useCreateSkill → SKILL_KEY 무효화', async () => {
    vi.mocked(api().skill.create).mockResolvedValue({ success: true, data: SKILL })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useCreateSkill(), { wrapper })
    await act(async () => {
      result.current.mutate({ name: 'new', description: '', content: '# X' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['skill'] })
  })

  it('useUpdateSkill → SKILL_KEY 무효화', async () => {
    vi.mocked(api().skill.update).mockResolvedValue({ success: true, data: SKILL })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateSkill(), { wrapper })
    await act(async () => {
      result.current.mutate({ id: 'sk-1', input: { description: 'x' } })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['skill'] })
  })
})

describe('useRemoveSkill / useResetSystemSkill', () => {
  it('useRemoveSkill → SKILL_KEY + trash 둘 다 무효화', async () => {
    vi.mocked(api().skill.remove).mockResolvedValue({ success: true, data: { batchId: 'b-1' } })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useRemoveSkill(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', id: 'sk-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['skill'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['trash'] })
  })

  it('useResetSystemSkill → SKILL_KEY 무효화', async () => {
    vi.mocked(api().skill.resetSystem).mockResolvedValue({ success: true, data: SKILL })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useResetSystemSkill(), { wrapper })
    await act(async () => {
      result.current.mutate({ id: 'sk-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['skill'] })
  })
})

describe('useApplySkill / useUnapplySkill', () => {
  it('useApplySkill → status 만 무효화', async () => {
    vi.mocked(api().skill.apply).mockResolvedValue({ success: true, data: STATUS })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useApplySkill(), { wrapper })
    await act(async () => {
      result.current.mutate({ id: 'sk-1', target: 'claude' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['skill', 'status'] })
  })

  it('useUnapplySkill → status 만 무효화', async () => {
    vi.mocked(api().skill.unapply).mockResolvedValue({ success: true, data: STATUS })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useUnapplySkill(), { wrapper })
    await act(async () => {
      result.current.mutate({ id: 'sk-1', target: 'codex' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['skill', 'status'] })
  })
})

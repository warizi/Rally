/**
 * widgets/workspace/model/use-workspace-is-empty.test.ts
 *
 * 4종 entity hook 집계 — isEmpty=true 는 4종 모두 0 이고 loading 도 끝났을 때만.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  notes: { data: [] as unknown[], isLoading: false },
  canvases: { data: [] as unknown[], isLoading: false },
  todos: { data: [] as unknown[], isLoading: false },
  schedules: { data: [] as unknown[], isLoading: false }
}))

vi.mock('@entities/note', () => ({ useNotesByWorkspace: () => mocks.notes }))
vi.mock('@entities/canvas', () => ({ useCanvasesByWorkspace: () => mocks.canvases }))
vi.mock('@entities/todo', () => ({ useTodosByWorkspace: () => mocks.todos }))
vi.mock('@entities/schedule', () => ({
  useAllSchedulesByWorkspace: () => mocks.schedules
}))

import { useWorkspaceIsEmpty } from '../use-workspace-is-empty'

beforeEach(() => {
  mocks.notes = { data: [], isLoading: false }
  mocks.canvases = { data: [], isLoading: false }
  mocks.todos = { data: [], isLoading: false }
  mocks.schedules = { data: [], isLoading: false }
})

describe('useWorkspaceIsEmpty', () => {
  it('4종 모두 빈 + loading 끝 → isEmpty=true', () => {
    const { result } = renderHook(() => useWorkspaceIsEmpty('ws-1'))
    expect(result.current.isEmpty).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.counts).toEqual({ notes: 0, canvases: 0, todos: 0, schedules: 0 })
  })

  it('notes 1개라도 있으면 → isEmpty=false', () => {
    mocks.notes = { data: [{ id: 'n1' }], isLoading: false }
    const { result } = renderHook(() => useWorkspaceIsEmpty('ws-1'))
    expect(result.current.isEmpty).toBe(false)
    expect(result.current.counts.notes).toBe(1)
  })

  it('아무 query 라도 loading → isEmpty=false + isLoading=true', () => {
    mocks.todos = { data: [], isLoading: true }
    const { result } = renderHook(() => useWorkspaceIsEmpty('ws-1'))
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isEmpty).toBe(false)
  })

  it('workspaceId null/undefined 도 hook 동작 (entity hook 이 빈 string/null 받아도 OK)', () => {
    const { result } = renderHook(() => useWorkspaceIsEmpty(null))
    expect(result.current.isEmpty).toBe(true)
  })

  it('각 도메인 counts 정확 반영', () => {
    mocks.notes = { data: [1, 2], isLoading: false }
    mocks.canvases = { data: [1], isLoading: false }
    mocks.todos = { data: [1, 2, 3], isLoading: false }
    mocks.schedules = { data: [], isLoading: false }
    const { result } = renderHook(() => useWorkspaceIsEmpty('ws-1'))
    expect(result.current.counts).toEqual({ notes: 2, canvases: 1, todos: 3, schedules: 0 })
    expect(result.current.isEmpty).toBe(false)
  })
})

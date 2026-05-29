/**
 * widgets/tab-system/model/use-tab-lock-state.test.ts
 *
 * tab.icon + tab.pathname 으로 note/csv/canvas-detail 분기 + workspace list 에서
 * 해당 entity 찾아 isLocked 반환, toggle 호출 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  toggleNoteMutate: vi.fn(),
  toggleCsvMutate: vi.fn(),
  toggleCanvasMutate: vi.fn(),
  notes: [] as Array<{ id: string; isLocked?: boolean }>,
  csvs: [] as Array<{ id: string; isLocked?: boolean }>,
  canvases: [] as Array<{ id: string; isLocked?: boolean }>,
  workspaceId: 'ws-1' as string | null
}))

vi.mock('@entities/note', () => ({
  useNotesByWorkspace: () => ({ data: mocks.notes }),
  useToggleNoteLock: () => ({ mutate: mocks.toggleNoteMutate })
}))
vi.mock('@entities/csv-file', () => ({
  useCsvFilesByWorkspace: () => ({ data: mocks.csvs }),
  useToggleCsvLock: () => ({ mutate: mocks.toggleCsvMutate })
}))
vi.mock('@entities/canvas', () => ({
  useCanvasesByWorkspace: () => ({ data: mocks.canvases }),
  useToggleCanvasLock: () => ({ mutate: mocks.toggleCanvasMutate })
}))
vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))

import { useTabLockState } from '../use-tab-lock-state'
import type { Tab } from '@/entities/tab-system'

function makeTab(icon: Tab['icon'], pathname: string): Tab {
  return { icon, pathname } as unknown as Tab
}

beforeEach(() => {
  mocks.toggleNoteMutate.mockClear()
  mocks.toggleCsvMutate.mockClear()
  mocks.toggleCanvasMutate.mockClear()
  mocks.notes = []
  mocks.csvs = []
  mocks.canvases = []
  mocks.workspaceId = 'ws-1'
})

describe('useTabLockState — 분기', () => {
  it('lockable 하지 않은 탭 (icon=dashboard) → isLockable=false', () => {
    const { result } = renderHook(() =>
      useTabLockState(makeTab('dashboard' as Tab['icon'], '/dashboard'))
    )
    expect(result.current.isLockable).toBe(false)
    expect(result.current.isLocked).toBe(false)
    // toggle 은 no-op
    act(() => result.current.toggle())
    expect(mocks.toggleNoteMutate).not.toHaveBeenCalled()
  })

  it('note 탭 + workspaceId 없음 → isLockable=false', () => {
    mocks.workspaceId = null
    const { result } = renderHook(() => useTabLockState(makeTab('note', '/folder/note/n-1')))
    expect(result.current.isLockable).toBe(false)
  })

  it('note 탭 + workspaceId 있음 → isLockable=true, isLocked 는 list 에서 조회', () => {
    mocks.notes = [{ id: 'n-1', isLocked: true }]
    const { result } = renderHook(() => useTabLockState(makeTab('note', '/folder/note/n-1')))
    expect(result.current.isLockable).toBe(true)
    expect(result.current.isLocked).toBe(true)
  })

  it('note 탭 + list 에 없는 id → isLocked=false 폴백', () => {
    mocks.notes = []
    const { result } = renderHook(() => useTabLockState(makeTab('note', '/folder/note/n-x')))
    expect(result.current.isLockable).toBe(true)
    expect(result.current.isLocked).toBe(false)
  })

  it('note 탭 toggle → !isLocked 로 호출', () => {
    mocks.notes = [{ id: 'n-1', isLocked: false }]
    const { result } = renderHook(() => useTabLockState(makeTab('note', '/folder/note/n-1')))
    act(() => result.current.toggle())
    expect(mocks.toggleNoteMutate).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      noteId: 'n-1',
      isLocked: true
    })
  })

  it('csv 탭 → toggleCsvLock 호출', () => {
    mocks.csvs = [{ id: 'c-1', isLocked: true }]
    const { result } = renderHook(() => useTabLockState(makeTab('csv', '/folder/csv/c-1')))
    expect(result.current.isLocked).toBe(true)
    act(() => result.current.toggle())
    expect(mocks.toggleCsvMutate).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      csvId: 'c-1',
      isLocked: false
    })
  })

  it('canvas-detail 탭 → toggleCanvasLock 호출', () => {
    mocks.canvases = [{ id: 'cv-1', isLocked: false }]
    const { result } = renderHook(() => useTabLockState(makeTab('canvas-detail', '/canvas/cv-1')))
    expect(result.current.isLocked).toBe(false)
    act(() => result.current.toggle())
    expect(mocks.toggleCanvasMutate).toHaveBeenCalledWith({
      canvasId: 'cv-1',
      isLocked: true,
      workspaceId: 'ws-1'
    })
  })

  it('pathname 에 trailing 이 없으면 (folder root) → isLockable=false', () => {
    // /folder/note 만 → extractTrailingId 가 null 반환 → isLockable false
    const { result } = renderHook(() => useTabLockState(makeTab('note', '/folder/note')))
    expect(result.current.isLockable).toBe(false)
  })

  it('pathname trailing 에 / 포함되면 (다중 segment) → null 반환 → isLockable=false', () => {
    const { result } = renderHook(() => useTabLockState(makeTab('note', '/folder/note/abc/extra')))
    expect(result.current.isLockable).toBe(false)
  })
})

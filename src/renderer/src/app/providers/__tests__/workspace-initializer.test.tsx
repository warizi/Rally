/**
 * app/providers/workspace-initializer.test.tsx
 *
 * Step 1: settings.get → initialize.
 * Step 2: 유효성 검사 → 잘못된 currentId 면 setCurrentWorkspaceId(workspaces[0]).
 * Step 3: onActiveChanged → syncFromMain.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  workspaces: [] as Array<{ id: string; name: string }>,
  currentWorkspaceId: null as string | null,
  isInitialized: false,
  initialize: vi.fn(),
  setCurrentWorkspaceId: vi.fn(),
  syncFromMain: vi.fn(),
  onActiveChanged: vi.fn().mockReturnValue(() => undefined)
}))

vi.mock('@entities/workspace', () => ({
  useWorkspaces: () => ({ data: mocks.workspaces })
}))
vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (
    sel: (s: {
      currentWorkspaceId: string | null
      isInitialized: boolean
      initialize: typeof mocks.initialize
      setCurrentWorkspaceId: typeof mocks.setCurrentWorkspaceId
      syncCurrentWorkspaceIdFromMain: typeof mocks.syncFromMain
    }) => unknown
  ) =>
    sel({
      currentWorkspaceId: mocks.currentWorkspaceId,
      isInitialized: mocks.isInitialized,
      initialize: mocks.initialize,
      setCurrentWorkspaceId: mocks.setCurrentWorkspaceId,
      syncCurrentWorkspaceIdFromMain: mocks.syncFromMain
    })
}))

import { WorkspaceInitializer } from '../workspace-initializer'

beforeEach(() => {
  mocks.workspaces = []
  mocks.currentWorkspaceId = null
  mocks.isInitialized = false
  mocks.initialize.mockClear()
  mocks.setCurrentWorkspaceId.mockClear()
  mocks.syncFromMain.mockClear()
  mocks.onActiveChanged.mockClear().mockReturnValue(() => undefined)
  ;(window as unknown as Record<string, unknown>).api = {
    settings: { get: vi.fn().mockResolvedValue({ success: true, data: null }) },
    workspace: {
      activate: vi.fn().mockResolvedValue({ success: true }),
      onActiveChanged: mocks.onActiveChanged
    }
  }
})

const api = (): typeof window.api => (window as unknown as { api: typeof window.api }).api

describe('WorkspaceInitializer', () => {
  it('null 컴포넌트', () => {
    const { container } = render(<WorkspaceInitializer />)
    expect(container.firstChild).toBeNull()
  })

  it('Step 1: settings.get 결과로 initialize 호출', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: 'ws-saved' })
    render(<WorkspaceInitializer />)
    await waitFor(() => expect(mocks.initialize).toHaveBeenCalledWith('ws-saved'))
  })

  it('Step 1: settings.get data 없음 → initialize(null)', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: undefined as never })
    render(<WorkspaceInitializer />)
    await waitFor(() => expect(mocks.initialize).toHaveBeenCalledWith(null))
  })

  it('Step 2: isInitialized + currentId 유효 → setCurrentWorkspaceId 안 호출, activate 호출', async () => {
    mocks.workspaces = [{ id: 'ws-1', name: 'A' }]
    mocks.currentWorkspaceId = 'ws-1'
    mocks.isInitialized = true
    render(<WorkspaceInitializer />)
    await waitFor(() => expect(api().workspace.activate).toHaveBeenCalledWith('ws-1'))
    expect(mocks.setCurrentWorkspaceId).not.toHaveBeenCalled()
  })

  it('Step 2: currentId 가 workspaces 에 없음 → 첫 번째로 setCurrentWorkspaceId', async () => {
    mocks.workspaces = [{ id: 'ws-1', name: 'A' }]
    mocks.currentWorkspaceId = 'ws-phantom'
    mocks.isInitialized = true
    render(<WorkspaceInitializer />)
    await waitFor(() => expect(mocks.setCurrentWorkspaceId).toHaveBeenCalledWith('ws-1'))
  })

  it('Step 2: isInitialized=false → activate 호출 안 함', () => {
    mocks.workspaces = [{ id: 'ws-1', name: 'A' }]
    mocks.currentWorkspaceId = 'ws-1'
    mocks.isInitialized = false
    render(<WorkspaceInitializer />)
    expect(api().workspace.activate).not.toHaveBeenCalled()
  })

  it('Step 3: onActiveChanged 콜백 → syncFromMain 호출', () => {
    let captured: ((id: string) => void) | null = null
    mocks.onActiveChanged.mockImplementation((cb: (id: string) => void) => {
      captured = cb
      return () => undefined
    })
    render(<WorkspaceInitializer />)
    captured!('ws-from-main')
    expect(mocks.syncFromMain).toHaveBeenCalledWith('ws-from-main')
  })
})

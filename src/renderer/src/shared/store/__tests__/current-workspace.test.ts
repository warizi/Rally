/**
 * shared/store/current-workspace.test.ts
 *
 * setCurrentWorkspaceId / syncCurrentWorkspaceIdFromMain / clearCurrentWorkspaceId / initialize.
 * settings.set + workspace.activate 호출 검증, syncFromMain 은 같은 id 면 no-op.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    settings: { set: vi.fn().mockResolvedValue({ success: true }) },
    workspace: { activate: vi.fn().mockResolvedValue({ success: true }) }
  }
  vi.clearAllMocks()
})

const api = (): typeof window.api => (window as unknown as { api: typeof window.api }).api

import { useCurrentWorkspaceStore } from '../current-workspace'

beforeEach(() => {
  useCurrentWorkspaceStore.setState({ currentWorkspaceId: null, isInitialized: false })
})

describe('initialize', () => {
  it('id 와 함께 호출 → isInitialized=true + currentWorkspaceId', () => {
    useCurrentWorkspaceStore.getState().initialize('ws-1')
    expect(useCurrentWorkspaceStore.getState().currentWorkspaceId).toBe('ws-1')
    expect(useCurrentWorkspaceStore.getState().isInitialized).toBe(true)
  })

  it('null 로 호출 → currentWorkspaceId=null + isInitialized=true', () => {
    useCurrentWorkspaceStore.getState().initialize(null)
    expect(useCurrentWorkspaceStore.getState().currentWorkspaceId).toBe(null)
    expect(useCurrentWorkspaceStore.getState().isInitialized).toBe(true)
  })
})

describe('setCurrentWorkspaceId', () => {
  it('state 갱신 + settings.set + workspace.activate 호출', () => {
    useCurrentWorkspaceStore.getState().setCurrentWorkspaceId('ws-2')
    expect(useCurrentWorkspaceStore.getState().currentWorkspaceId).toBe('ws-2')
    expect(api().settings.set).toHaveBeenCalledWith('currentWorkspaceId', 'ws-2')
    expect(api().workspace.activate).toHaveBeenCalledWith('ws-2')
  })
})

describe('syncCurrentWorkspaceIdFromMain', () => {
  it('같은 id → no-op (settings.set 호출 안 함)', () => {
    useCurrentWorkspaceStore.setState({ currentWorkspaceId: 'ws-1' })
    useCurrentWorkspaceStore.getState().syncCurrentWorkspaceIdFromMain('ws-1')
    expect(api().settings.set).not.toHaveBeenCalled()
  })

  it('다른 id → state 갱신 + settings.set, 단 workspace.activate 는 호출 안 함', () => {
    useCurrentWorkspaceStore.setState({ currentWorkspaceId: 'ws-1' })
    useCurrentWorkspaceStore.getState().syncCurrentWorkspaceIdFromMain('ws-2')
    expect(useCurrentWorkspaceStore.getState().currentWorkspaceId).toBe('ws-2')
    expect(api().settings.set).toHaveBeenCalledWith('currentWorkspaceId', 'ws-2')
    expect(api().workspace.activate).not.toHaveBeenCalled()
  })
})

describe('clearCurrentWorkspaceId', () => {
  it('state 를 null 로 + settings.set 빈 문자열', () => {
    useCurrentWorkspaceStore.setState({ currentWorkspaceId: 'ws-1' })
    useCurrentWorkspaceStore.getState().clearCurrentWorkspaceId()
    expect(useCurrentWorkspaceStore.getState().currentWorkspaceId).toBe(null)
    expect(api().settings.set).toHaveBeenCalledWith('currentWorkspaceId', '')
  })
})

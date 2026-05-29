/**
 * 4개 entity watcher 회귀 테스트 (한 파일).
 *
 * 각 watcher 는 useEffect 마운트 시 window.api.X.onChanged 구독,
 * unmount 시 unsubscribe. 콜백에서 정확한 query key 무효화.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useCanvasWatcher } from '../canvas/model/use-canvas-watcher'
import { useTrashWatcher } from '../trash/model/use-trash-watcher'
import { useEntityLinkWatcher } from '../entity-link/model/use-entity-link-watcher'

beforeEach(() => {
  const apis = ['canvas', 'trash', 'entityLink'] as const
  const unsubMocks = new Map<string, ReturnType<typeof vi.fn>>()
  const onChangedMocks = new Map<string, ReturnType<typeof vi.fn>>()
  for (const key of apis) {
    const unsub = vi.fn()
    const onChanged = vi.fn(() => unsub)
    unsubMocks.set(key, unsub)
    onChangedMocks.set(key, onChanged)
  }
  ;(window as unknown as Record<string, unknown>).api = {
    canvas: { onChanged: onChangedMocks.get('canvas') },
    trash: { onChanged: onChangedMocks.get('trash') },
    entityLink: { onChanged: onChangedMocks.get('entityLink') }
  }
  ;(globalThis as unknown as Record<string, unknown>).__watcherMocks = {
    unsub: unsubMocks,
    onChanged: onChangedMocks
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
  delete (globalThis as unknown as Record<string, unknown>).__watcherMocks
})

function makeWrapper(): {
  wrapper: ({ children }: { children: ReactNode }) => ReactElement
  qc: QueryClient
} {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }): ReactElement =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

function getMocks(): {
  unsub: Map<string, ReturnType<typeof vi.fn>>
  onChanged: Map<string, ReturnType<typeof vi.fn>>
} {
  return (globalThis as unknown as { __watcherMocks: ReturnType<typeof getMocks> }).__watcherMocks
}

describe('useCanvasWatcher', () => {
  it('mount → onChanged 구독; 콜백 → 4종 키 무효화; unmount → unsub', () => {
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { unmount } = renderHook(() => useCanvasWatcher(), { wrapper })

    const m = getMocks()
    expect(m.onChanged.get('canvas')).toHaveBeenCalled()
    const cb = m.onChanged.get('canvas')!.mock.calls[0][0] as (workspaceId: string) => void
    cb('ws-1')
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['canvas', 'workspace', 'ws-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['canvas', 'detail'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['canvasNode'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['canvasEdge'] })

    unmount()
    expect(m.unsub.get('canvas')).toHaveBeenCalled()
  })
})

describe('useTrashWatcher', () => {
  it('mount → onChanged 구독; 콜백 → 11종 키 무효화', () => {
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { unmount } = renderHook(() => useTrashWatcher(), { wrapper })

    const m = getMocks()
    const cb = m.onChanged.get('trash')!.mock.calls[0][0] as () => void
    cb()

    for (const key of [
      'trash',
      'note',
      'csv',
      'pdf',
      'image',
      'folder',
      'todo',
      'canvas',
      'schedule',
      'recurringRule',
      'entityLink',
      'history'
    ]) {
      expect(invSpy).toHaveBeenCalledWith({ queryKey: [key] })
    }

    unmount()
    expect(m.unsub.get('trash')).toHaveBeenCalled()
  })
})

describe('useEntityLinkWatcher', () => {
  it('mount → onChanged 구독; 콜백 → entityLink + history 무효화; unmount cleanup', () => {
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { unmount } = renderHook(() => useEntityLinkWatcher(), { wrapper })

    const m = getMocks()
    const cb = m.onChanged.get('entityLink')!.mock.calls[0][0] as () => void
    cb()

    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['entityLink'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['history'] })

    unmount()
    expect(m.unsub.get('entityLink')).toHaveBeenCalled()
  })
})

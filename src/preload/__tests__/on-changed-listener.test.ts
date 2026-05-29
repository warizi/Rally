/**
 * createOnChangedListener: ipcRenderer.on + removeListener wrapper.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { onMock, removeListenerMock } = vi.hoisted(() => ({
  onMock: vi.fn(),
  removeListenerMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcRenderer: {
    on: onMock,
    removeListener: removeListenerMock
  }
}))

import { createOnChangedListener } from '../lib/on-changed-listener'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createOnChangedListener', () => {
  it('callback 구독 → ipcRenderer.on 호출', () => {
    const subscribe = createOnChangedListener('note:changed')
    const cb = vi.fn()
    subscribe(cb)
    expect(onMock).toHaveBeenCalledWith('note:changed', expect.any(Function))
  })

  it('handler 내부 → callback 호출 시 (workspaceId, paths, actor) 인자 그대로 전달', () => {
    const subscribe = createOnChangedListener('note:changed')
    const cb = vi.fn()
    subscribe(cb)
    const handler = onMock.mock.calls[0][1] as (
      _: unknown,
      ws: string,
      paths: string[],
      actor: unknown
    ) => void

    handler({}, 'ws-aabbcc12', ['a.md'], { kind: 'user', id: null })
    expect(cb).toHaveBeenCalledWith('ws-aabbcc12', ['a.md'], { kind: 'user', id: null })
  })

  it('actor 가 undefined 인 경우 → null 로 정규화', () => {
    const subscribe = createOnChangedListener('csv:changed')
    const cb = vi.fn()
    subscribe(cb)
    const handler = onMock.mock.calls[0][1] as (
      _: unknown,
      ws: string,
      paths: string[],
      actor: unknown
    ) => void

    handler({}, 'ws-aabbcc12', [], undefined)
    expect(cb).toHaveBeenCalledWith('ws-aabbcc12', [], null)
  })

  it('반환된 unsubscribe → ipcRenderer.removeListener 호출', () => {
    const subscribe = createOnChangedListener('todo:changed')
    const unsubscribe = subscribe(vi.fn())
    unsubscribe()
    expect(removeListenerMock).toHaveBeenCalledWith('todo:changed', expect.any(Function))
  })
})

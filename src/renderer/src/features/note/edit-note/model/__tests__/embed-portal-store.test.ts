/**
 * features/note/edit-note/model/embed-portal-store.test.ts
 *
 * register / unregister / updateEntry — 없는 portalId 업데이트는 no-op.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useEmbedPortalStore, type PortalEntry } from '../embed-portal-store'

function entry(portalId: string, height = 100): PortalEntry {
  return {
    portalId,
    editorId: 'ed-1',
    host: {} as HTMLElement,
    domain: 'note',
    entityId: 'n-1',
    height,
    onHeightChange: (): void => {}
  } as unknown as PortalEntry
}

beforeEach(() => {
  useEmbedPortalStore.setState({ entries: {} })
})

describe('useEmbedPortalStore', () => {
  it('register 추가', () => {
    useEmbedPortalStore.getState().register(entry('p1'))
    expect(useEmbedPortalStore.getState().entries['p1']).toBeDefined()
  })

  it('register 같은 id → 덮어쓰기', () => {
    useEmbedPortalStore.getState().register(entry('p1', 100))
    useEmbedPortalStore.getState().register(entry('p1', 200))
    expect(useEmbedPortalStore.getState().entries['p1'].height).toBe(200)
  })

  it('unregister → 해당 entry 삭제', () => {
    useEmbedPortalStore.getState().register(entry('p1'))
    useEmbedPortalStore.getState().register(entry('p2'))
    useEmbedPortalStore.getState().unregister('p1')
    expect(useEmbedPortalStore.getState().entries).toEqual({ p2: expect.anything() })
  })

  it('unregister 없는 id → 기존 entries 유지', () => {
    useEmbedPortalStore.getState().register(entry('p1'))
    useEmbedPortalStore.getState().unregister('p-phantom')
    expect(Object.keys(useEmbedPortalStore.getState().entries)).toEqual(['p1'])
  })

  it('updateEntry 부분 patch (height)', () => {
    useEmbedPortalStore.getState().register(entry('p1', 100))
    useEmbedPortalStore.getState().updateEntry('p1', { height: 250 })
    expect(useEmbedPortalStore.getState().entries['p1'].height).toBe(250)
    expect(useEmbedPortalStore.getState().entries['p1'].entityId).toBe('n-1') // 다른 필드 유지
  })

  it('updateEntry 없는 id → no-op (state 동일)', () => {
    const before = useEmbedPortalStore.getState().entries
    useEmbedPortalStore.getState().updateEntry('p-phantom', { height: 999 })
    expect(useEmbedPortalStore.getState().entries).toBe(before)
  })
})

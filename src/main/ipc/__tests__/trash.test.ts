/**
 * trash IPC 핸들러 회귀 테스트.
 * trash:emptyAll 은 list-then-purge 루프 + hasMore 페이지네이션을 포함하므로 별도 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => makeIpcMainMock())

vi.mock('../../services/trash', () => ({
  trashService: {
    list: vi.fn(),
    countByWorkspace: vi.fn(),
    restore: vi.fn(),
    purge: vi.fn(),
    getRetention: vi.fn(),
    setRetention: vi.fn(),
    sweepAll: vi.fn(),
    softRemove: vi.fn()
  }
}))

import { registerTrashHandlers } from '../trash'
import { trashService } from '../../services/trash'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerTrashHandlers()
})

describe('trash IPC handlers', () => {
  it('주요 채널 등록', () => {
    const channels = [
      'trash:list',
      'trash:count',
      'trash:restore',
      'trash:purge',
      'trash:emptyAll',
      'trash:getRetention',
      'trash:setRetention',
      'trash:sweepNow',
      'trash:softRemove'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('trash:list → options 기본값 {}', () => {
    vi.mocked(trashService.list).mockReturnValue({
      batches: [],
      total: 0,
      hasMore: false,
      nextOffset: 0
    } as unknown as ReturnType<typeof trashService.list>)
    getHandler('trash:list')({}, 'ws-aabbcc12')
    expect(trashService.list).toHaveBeenCalledWith('ws-aabbcc12', {})
  })

  it('trash:purge → service.purge + { success: true }', () => {
    const result = getHandler('trash:purge')({}, 'ws-aabbcc12', 'batch-aabbcc')
    expect(trashService.purge).toHaveBeenCalledWith('batch-aabbcc')
    expect(result).toEqual({ success: true, data: { success: true } })
  })

  it('trash:setRetention → service.setRetention + { value }', () => {
    const result = getHandler('trash:setRetention')({}, '30d')
    expect(trashService.setRetention).toHaveBeenCalledWith('30d')
    expect(result).toEqual({ success: true, data: { value: '30d' } })
  })

  it('trash:sweepNow → sweepAll 결과를 { purged } 로 래핑', () => {
    vi.mocked(trashService.sweepAll).mockReturnValue(42)
    const result = getHandler('trash:sweepNow')()
    expect(result).toEqual({ success: true, data: { purged: 42 } })
  })

  it('trash:emptyAll → list-then-purge 루프 + hasMore 따라 재호출', () => {
    let callCount = 0
    vi.mocked(trashService.list).mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          batches: [{ id: 'b1' }, { id: 'b2' }],
          hasMore: true,
          total: 3,
          nextOffset: 2
        } as unknown as ReturnType<typeof trashService.list>
      }
      return {
        batches: [{ id: 'b3' }],
        hasMore: false,
        total: 1,
        nextOffset: 1
      } as unknown as ReturnType<typeof trashService.list>
    })

    const result = getHandler<{ success: boolean; data: { purgedBatchIds: string[] } }>(
      'trash:emptyAll'
    )({}, 'ws-aabbcc12') as { success: boolean; data: { purgedBatchIds: string[] } }

    expect(trashService.purge).toHaveBeenCalledTimes(3)
    expect(result.data.purgedBatchIds).toEqual(['b1', 'b2', 'b3'])
  })

  it('trash:softRemove → batchId 반환', () => {
    vi.mocked(trashService.softRemove).mockReturnValue('batch-newaabb')
    const result = getHandler('trash:softRemove')({}, 'ws-aabbcc12', 'note', 'n-aabbcc1')
    expect(trashService.softRemove).toHaveBeenCalledWith('ws-aabbcc12', 'note', 'n-aabbcc1')
    expect(result).toEqual({ success: true, data: { batchId: 'batch-newaabb' } })
  })
})

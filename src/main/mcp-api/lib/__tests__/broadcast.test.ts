/**
 * broadcastChanged 단위 테스트.
 *
 * BrowserWindow.getAllWindows() 의 모든 webContents 로 send + recent-writes 등록.
 * actor null/undefined 정규화 분기.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { sendMock, getAllWindowsMock, markRecentWriteMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  getAllWindowsMock: vi.fn(),
  markRecentWriteMock: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: getAllWindowsMock }
}))
vi.mock('../../../lib/recent-writes', () => ({
  markRecentWrite: markRecentWriteMock
}))

import { broadcastChanged } from '../broadcast'

beforeEach(() => {
  vi.clearAllMocks()
  getAllWindowsMock.mockReturnValue([{ webContents: { send: sendMock } }])
})

describe('broadcastChanged', () => {
  it('각 path 를 markRecentWrite + 모든 윈도우에 send', () => {
    broadcastChanged('note:changed', 'ws-1', ['a.md', 'b.md'], { kind: 'user', id: null })

    expect(markRecentWriteMock).toHaveBeenCalledWith('ws-1', 'a.md')
    expect(markRecentWriteMock).toHaveBeenCalledWith('ws-1', 'b.md')
    expect(sendMock).toHaveBeenCalledWith('note:changed', 'ws-1', ['a.md', 'b.md'], {
      kind: 'user',
      id: null
    })
  })

  it('actor 없음 → payload null 로 정규화', () => {
    broadcastChanged('note:changed', 'ws-1', [])
    expect(sendMock).toHaveBeenCalledWith('note:changed', 'ws-1', [], null)
  })

  it('actor.id undefined → null 로 정규화', () => {
    broadcastChanged('todo:changed', 'ws-1', [], { kind: 'ai', id: null })
    const lastCall = sendMock.mock.calls[sendMock.mock.calls.length - 1]
    expect(lastCall[3]).toEqual({ kind: 'ai', id: null })
  })

  it('paths 빈 배열 → markRecentWrite 호출 없음 (DB-only 채널)', () => {
    broadcastChanged('schedule:changed', 'ws-1', [])
    expect(markRecentWriteMock).not.toHaveBeenCalled()
  })

  it('윈도우 0개 → send 호출 없이 정상 동작', () => {
    getAllWindowsMock.mockReturnValue([])
    expect(() => broadcastChanged('note:changed', 'ws-1', ['x.md'])).not.toThrow()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('빈 path 는 markRecentWrite 호출 안 함 (falsy 가드)', () => {
    broadcastChanged('note:changed', 'ws-1', ['', 'x.md'])
    expect(markRecentWriteMock).toHaveBeenCalledTimes(1)
    expect(markRecentWriteMock).toHaveBeenCalledWith('ws-1', 'x.md')
  })
})

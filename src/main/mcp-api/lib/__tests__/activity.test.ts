import { describe, it, expect, vi, beforeEach } from 'vitest'

const { sendMock, getAllWindowsMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  getAllWindowsMock: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: getAllWindowsMock }
}))

import {
  createActivityCollector,
  recordGroupedActivity,
  emitMcpActivity,
  type McpActivityRecord
} from '../activity'

beforeEach(() => {
  sendMock.mockReset()
  getAllWindowsMock.mockReset()
  getAllWindowsMock.mockReturnValue([{ webContents: { send: sendMock } }])
})

describe('createActivityCollector', () => {
  it('빈 items record 는 버린다', () => {
    const c = createActivityCollector()
    c.record({ domain: 'note', operation: 'create', items: [] })
    c.record({ domain: 'note', operation: 'create', items: [{ type: 'note', id: 'n1', title: 'A' }] })
    const drained = c.drain()
    expect(drained).toHaveLength(1)
    expect(drained[0].items[0].id).toBe('n1')
  })

  it('drain 은 비우고 반환한다', () => {
    const c = createActivityCollector()
    c.record({ domain: 'todo', operation: 'create', items: [{ type: 'todo', id: 't1', title: 'T' }] })
    expect(c.drain()).toHaveLength(1)
    expect(c.drain()).toHaveLength(0)
  })
})

describe('recordGroupedActivity', () => {
  it('(domain, operation) 단위로 묶는다', () => {
    const records: McpActivityRecord[] = []
    recordGroupedActivity((r) => records.push(r), [
      { domain: 'note', operation: 'create', item: { type: 'note', id: 'n1', title: 'A' } },
      { domain: 'note', operation: 'create', item: { type: 'note', id: 'n2', title: 'B' } },
      { domain: 'note', operation: 'delete', item: { type: 'note', id: 'n3', title: 'C' } },
      { domain: 'csv', operation: 'create', item: { type: 'csv', id: 'c1', title: 'D' } }
    ])
    expect(records).toHaveLength(3)
    const noteCreate = records.find((r) => r.domain === 'note' && r.operation === 'create')
    expect(noteCreate?.items.map((i) => i.id)).toEqual(['n1', 'n2'])
    expect(records.find((r) => r.operation === 'delete')?.items).toHaveLength(1)
  })
})

describe('emitMcpActivity', () => {
  it('records 가 있으면 모든 윈도우로 mcp:activity 발행', () => {
    emitMcpActivity('ws-1', { kind: 'ai', id: 'claude-code' }, [
      { domain: 'note', operation: 'create', items: [{ type: 'note', id: 'n1', title: 'A' }] }
    ])
    expect(sendMock).toHaveBeenCalledTimes(1)
    const [channel, payload] = sendMock.mock.calls[0]
    expect(channel).toBe('mcp:activity')
    expect(payload.workspaceId).toBe('ws-1')
    expect(payload.actor).toEqual({ kind: 'ai', id: 'claude-code' })
    expect(payload.records).toHaveLength(1)
  })

  it('빈 records 는 발행하지 않는다', () => {
    emitMcpActivity('ws-1', { kind: 'ai', id: null }, [])
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('윈도우 접근 실패가 throw 로 전파되지 않는다', () => {
    getAllWindowsMock.mockImplementation(() => {
      throw new Error('no windows')
    })
    expect(() =>
      emitMcpActivity('ws-1', { kind: 'ai', id: null }, [
        { domain: 'note', operation: 'create', items: [{ type: 'note', id: 'n1', title: 'A' }] }
      ])
    ).not.toThrow()
  })
})

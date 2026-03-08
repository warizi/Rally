import { describe, expect, it } from 'vitest'
import { TabSnapshotSchema } from '../types'

const validData = {
  id: 'snap-1',
  name: 'My Snapshot',
  description: null,
  workspaceId: 'ws-1',
  tabsJson: '{"tab-1":{}}',
  panesJson: '{"pane-1":{}}',
  layoutJson: '{"type":"pane"}',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02')
}

describe('TabSnapshotSchema', () => {
  it('유효한 데이터를 파싱한다', () => {
    const result = TabSnapshotSchema.parse(validData)
    expect(result.id).toBe('snap-1')
    expect(result.name).toBe('My Snapshot')
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.updatedAt).toBeInstanceOf(Date)
  })

  it('name이 빈 문자열이면 파싱 실패하고 한국어 오류 메시지를 반환한다', () => {
    const result = TabSnapshotSchema.safeParse({ ...validData, name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('스냅샷 이름은 필수입니다')
    }
  })

  it('description이 null이어도 파싱 성공한다', () => {
    const result = TabSnapshotSchema.safeParse({ ...validData, description: null })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBeNull()
    }
  })

  it('description이 문자열이어도 파싱 성공한다', () => {
    const result = TabSnapshotSchema.safeParse({ ...validData, description: 'memo' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe('memo')
    }
  })

  it('createdAt이 숫자(timestamp ms)면 Date로 변환된다', () => {
    const ts = 1700000000000
    const result = TabSnapshotSchema.safeParse({ ...validData, createdAt: ts })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.createdAt).toBeInstanceOf(Date)
      expect(result.data.createdAt.getTime()).toBe(ts)
    }
  })

  it('updatedAt이 ISO 날짜 문자열이면 Date로 변환된다', () => {
    const result = TabSnapshotSchema.safeParse({ ...validData, updatedAt: '2026-02-24T00:00:00Z' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.updatedAt).toBeInstanceOf(Date)
    }
  })
})

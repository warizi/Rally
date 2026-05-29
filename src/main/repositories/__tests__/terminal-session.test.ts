/**
 * terminalSessionRepository 통합 테스트 (testDb).
 *
 * CRUD + saveSnapshot + findActiveByWorkspaceId 정렬·필터 검증.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { terminalSessionRepository, type TerminalSessionInsert } from '../terminal-session'

const WS_ID = 'ws-aabbcc12'

beforeEach(() => {
  testDb
    .insert(schema.workspaces)
    .values({
      id: WS_ID,
      name: 'Test',
      path: '/test',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
})

function makeSession(overrides?: Partial<TerminalSessionInsert>): TerminalSessionInsert {
  return {
    id: 'sess-aabbcc',
    workspaceId: WS_ID,
    layoutId: null,
    name: 'zsh',
    cwd: '/tmp',
    shell: 'zsh',
    rows: 24,
    cols: 80,
    screenSnapshot: null,
    sortOrder: 0,
    isActive: 1,
    ...overrides
  }
}

describe('terminalSessionRepository', () => {
  it('create + findActiveByWorkspaceId → 활성 세션만 sortOrder 순 반환', () => {
    terminalSessionRepository.create(makeSession({ id: 'sess-a', sortOrder: 2 }))
    terminalSessionRepository.create(makeSession({ id: 'sess-b', sortOrder: 0 }))
    terminalSessionRepository.create(makeSession({ id: 'sess-c', sortOrder: 1, isActive: 0 }))

    const sessions = terminalSessionRepository.findActiveByWorkspaceId(WS_ID)
    expect(sessions.map((s) => s.id)).toEqual(['sess-b', 'sess-a'])
  })

  it('update → 부분 필드 갱신', () => {
    terminalSessionRepository.create(makeSession({ id: 'sess-up', name: 'zsh', cols: 80 }))
    terminalSessionRepository.update('sess-up', { name: 'bash', cols: 120 })
    const [updated] = terminalSessionRepository.findActiveByWorkspaceId(WS_ID)
    expect(updated.name).toBe('bash')
    expect(updated.cols).toBe(120)
  })

  it('softDelete → isActive=0 → findActive 결과에서 제외', () => {
    terminalSessionRepository.create(makeSession({ id: 'sess-del' }))
    terminalSessionRepository.softDelete('sess-del')
    const sessions = terminalSessionRepository.findActiveByWorkspaceId(WS_ID)
    expect(sessions).toHaveLength(0)
  })

  it('saveSnapshot → screenSnapshot 저장', () => {
    terminalSessionRepository.create(makeSession({ id: 'sess-snap' }))
    terminalSessionRepository.saveSnapshot('sess-snap', 'SCREEN-CONTENTS')
    const [s] = terminalSessionRepository.findActiveByWorkspaceId(WS_ID)
    expect(s.screenSnapshot).toBe('SCREEN-CONTENTS')
  })
})

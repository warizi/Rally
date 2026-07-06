/**
 * skill IPC 핸들러 회귀 테스트.
 * - update / resetSystem: stale 적용 자동 해제 분기 (isApplied → unapply)
 * - remove: ensureCustomDeletable + trashService.softRemove + cleanupByName 3단계
 * - export: handleAsync (다른 핸들러는 sync handle)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => makeIpcMainMock())

vi.mock('../../services/skill', () => ({
  skillService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    ensureCustomDeletable: vi.fn(),
    resetSystem: vi.fn()
  }
}))
vi.mock('../../services/skill-sync', () => ({
  skillSyncService: {
    isApplied: vi.fn(),
    apply: vi.fn(),
    unapply: vi.fn(),
    unapplyStale: vi.fn(),
    status: vi.fn(),
    cleanupByName: vi.fn()
  }
}))
vi.mock('../../services/skill-export', () => ({
  skillExportService: { exportWithDialog: vi.fn() }
}))
vi.mock('../../services/trash', () => ({
  trashService: { softRemove: vi.fn() }
}))

import { registerSkillHandlers } from '../skill'
import { skillService } from '../../services/skill'
import { skillSyncService } from '../../services/skill-sync'
import { skillExportService } from '../../services/skill-export'
import { trashService } from '../../services/trash'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerSkillHandlers()
})

describe('skill IPC handlers', () => {
  it('주요 채널 등록', () => {
    const channels = [
      'skill:list',
      'skill:get',
      'skill:create',
      'skill:update',
      'skill:remove',
      'skill:resetSystem',
      'skill:apply',
      'skill:unapply',
      'skill:status',
      'skill:export'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('skill:update → 모든 타겟 stale 적용본 해제 (unapplyStale)', () => {
    vi.mocked(skillService.update).mockReturnValue({
      id: 'sk-aabbcc1',
      name: 'my-skill'
    } as unknown as ReturnType<typeof skillService.update>)

    getHandler('skill:update')({}, 'sk-aabbcc1', { description: 'new' })

    expect(skillService.update).toHaveBeenCalled()
    expect(skillSyncService.unapplyStale).toHaveBeenCalledWith('sk-aabbcc1')
  })

  it('skill:remove → ensureCustomDeletable + softRemove + cleanupByName 순서 호출', () => {
    vi.mocked(skillService.ensureCustomDeletable).mockReturnValue({
      name: 'my-skill'
    } as unknown as ReturnType<typeof skillService.ensureCustomDeletable>)
    vi.mocked(trashService.softRemove).mockReturnValue('batch-aabbcc')

    const result = getHandler('skill:remove')({}, 'ws-aabbcc12', 'sk-aabbcc1')

    expect(skillService.ensureCustomDeletable).toHaveBeenCalledWith('sk-aabbcc1')
    expect(trashService.softRemove).toHaveBeenCalledWith(
      'ws-aabbcc12',
      'custom_skill',
      'sk-aabbcc1'
    )
    expect(skillSyncService.cleanupByName).toHaveBeenCalledWith('my-skill')
    expect(result).toEqual({ success: true, data: { batchId: 'batch-aabbcc' } })
  })

  it('skill:resetSystem → 모든 타겟 stale 적용본 해제 (unapplyStale)', () => {
    vi.mocked(skillService.resetSystem).mockReturnValue({
      id: 'sys-aabbcc',
      name: 'system-skill'
    } as unknown as ReturnType<typeof skillService.resetSystem>)

    getHandler('skill:resetSystem')({}, 'sys-aabbcc')

    expect(skillSyncService.unapplyStale).toHaveBeenCalledWith('sys-aabbcc')
  })

  // 회귀: 시스템 skill ID 는 'system:rally' 형태(':' 포함)라 nanoid 스키마로는
  // 'invalid nanoid format' 으로 거부됐다 (스킬 적용/수정/리셋 전부 불가 버그).
  it("skill:apply → 시스템 ID 'system:rally' 통과", () => {
    vi.mocked(skillSyncService.apply).mockReturnValue({
      id: 'system:rally',
      name: 'rally',
      applied: { claude: true, codex: false }
    } as unknown as ReturnType<typeof skillSyncService.apply>)

    const result = getHandler('skill:apply')({}, 'system:rally', 'claude')

    expect(skillSyncService.apply).toHaveBeenCalledWith('system:rally', 'claude')
    expect(result).toMatchObject({ success: true })
  })

  it("skill:update / skill:resetSystem → 시스템 ID 'system:rally-plan' 통과", () => {
    vi.mocked(skillService.update).mockReturnValue({
      id: 'system:rally-plan',
      name: 'rally-plan'
    } as unknown as ReturnType<typeof skillService.update>)
    vi.mocked(skillService.resetSystem).mockReturnValue({
      id: 'system:rally-plan',
      name: 'rally-plan'
    } as unknown as ReturnType<typeof skillService.resetSystem>)

    const updated = getHandler('skill:update')({}, 'system:rally-plan', { content: 'new' })
    const reset = getHandler('skill:resetSystem')({}, 'system:rally-plan')

    expect(updated).toMatchObject({ success: true })
    expect(reset).toMatchObject({ success: true })
    expect(skillSyncService.unapplyStale).toHaveBeenCalledWith('system:rally-plan')
  })

  it("skill:apply → 'system:' 뒤 비정상 name (경로 탈출 등) 거부", () => {
    for (const bad of ['system:../evil', 'system:', 'system:UPPER', 'system:a/b']) {
      const result = getHandler('skill:apply')({}, bad, 'claude')
      expect(result).toMatchObject({ success: false })
      expect(skillSyncService.apply).not.toHaveBeenCalled()
    }
  })

  it('skill:export → handleAsync (Promise 반환)', async () => {
    vi.mocked(skillExportService.exportWithDialog).mockResolvedValue({
      saved: true,
      path: '/x.zip'
    } as unknown as Awaited<ReturnType<typeof skillExportService.exportWithDialog>>)

    const result = await getHandler('skill:export')({}, 'sk-aabbcc1')
    expect(skillExportService.exportWithDialog).toHaveBeenCalledWith('sk-aabbcc1')
    expect(result).toMatchObject({ success: true })
  })
})

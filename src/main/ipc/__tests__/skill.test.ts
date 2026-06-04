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

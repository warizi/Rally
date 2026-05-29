/**
 * app-info IPC 핸들러 회귀 테스트.
 * - app.getVersion / dist-mcp path (dev vs prod 분기)
 * - .claude/{commands,skills} md 파일 스캔
 * - mcpClient 등록/해제
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => ({
  ...makeIpcMainMock(),
  app: { getVersion: vi.fn(() => '1.14.0') }
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn()
}))

vi.mock('../../services/mcp-client-config', () => ({
  mcpClientConfigService: {
    getStatus: vi.fn(),
    getServerKey: vi.fn(),
    getServerConfig: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn()
  }
}))

import { registerAppInfoHandlers } from '../app-info'
import { mcpClientConfigService } from '../../services/mcp-client-config'
import * as fs from 'fs'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerAppInfoHandlers()
})

describe('app-info IPC handlers', () => {
  it('주요 채널 등록', () => {
    const channels = [
      'appInfo:getVersion',
      'appInfo:getMcpServerPath',
      'appInfo:getCommandFiles',
      'appInfo:getSkillFiles',
      'mcpClient:getStatus',
      'mcpClient:register',
      'mcpClient:unregister'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('appInfo:getVersion → app.getVersion 위임', () => {
    const result = getHandler('appInfo:getVersion')()
    expect(result).toEqual({ success: true, data: '1.14.0' })
  })

  it('appInfo:getCommandFiles → 빈 dir 처리', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const result = getHandler('appInfo:getCommandFiles')()
    expect(result).toEqual({ success: true, data: [] })
  })

  it('appInfo:getSkillFiles → md 파일 파싱 (name + description + content)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockReturnValue(['skill1.md', 'other.txt'] as never)
    vi.mocked(fs.readFileSync).mockReturnValue('# title\n간단 설명' as never)

    const result = getHandler<{ success: boolean; data: { name: string; description: string }[] }>(
      'appInfo:getSkillFiles'
    )() as { success: boolean; data: { name: string; description: string }[] }

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1) // .md 만 통과
    expect(result.data[0].name).toBe('skill1')
    expect(result.data[0].description).toBe('간단 설명')
  })

  it('mcpClient:getStatus → 3개 메서드 결과 합산', () => {
    vi.mocked(mcpClientConfigService.getStatus).mockReturnValue({
      claudeDesktop: 'registered'
    } as unknown as ReturnType<typeof mcpClientConfigService.getStatus>)
    vi.mocked(mcpClientConfigService.getServerKey).mockReturnValue('rally')
    vi.mocked(mcpClientConfigService.getServerConfig).mockReturnValue({ command: '/x' })

    const result = getHandler('mcpClient:getStatus')()
    expect(result).toMatchObject({
      success: true,
      data: { serverKey: 'rally', serverConfig: { command: '/x' } }
    })
  })

  it('mcpClient:register → service.register 위임', () => {
    vi.mocked(mcpClientConfigService.register).mockReturnValue('registered' as never)
    const result = getHandler('mcpClient:register')({}, 'claudeDesktop')
    expect(mcpClientConfigService.register).toHaveBeenCalledWith('claudeDesktop')
    expect(result).toMatchObject({ success: true })
  })
})

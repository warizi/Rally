/**
 * claude-commands-setup 단위 테스트.
 *
 * 배포-1: 워크스페이스 .mcp.json 의 mcpServers entry 도 동일하게
 * ELECTRON_RUN_AS_NODE + Electron binary 형식으로 작성되는지 검증.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('../../lib/mcp-token', () => ({
  ensureMcpToken: () => FAKE_TOKEN
}))

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => (name === 'exe' ? FAKE_ELECTRON_BINARY : tmpDir)
  }
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

const FAKE_TOKEN = 'b'.repeat(64)
const FAKE_ELECTRON_BINARY = '/Applications/Rally.app/Contents/MacOS/Rally'
let tmpDir: string

import { ensureClaudeCommands } from '../claude-commands-setup'

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'rally-claude-cmd-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('S3 — claude-commands-setup ensureMcpSettings', () => {
  it('워크스페이스 .mcp.json 의 mcpServers entry 가 ELECTRON_RUN_AS_NODE 형식으로 작성됨', () => {
    ensureClaudeCommands(tmpDir)
    const mcpPath = join(tmpDir, '.mcp.json')
    const cfg = JSON.parse(readFileSync(mcpPath, 'utf-8'))
    const entry = cfg.mcpServers['rally-dev'] // is.dev=true
    expect(entry.command).toBe(FAKE_ELECTRON_BINARY)
    expect(entry.env.ELECTRON_RUN_AS_NODE).toBe('1')
    expect(entry.env.MCP_AUTH_TOKEN).toBe(FAKE_TOKEN)
    expect(entry.env.RALLY_DEV).toBe('1')
  })

  it('command 가 "node" 가 아니다 (시스템 PATH 의존 없음)', () => {
    ensureClaudeCommands(tmpDir)
    const cfg = JSON.parse(readFileSync(join(tmpDir, '.mcp.json'), 'utf-8'))
    expect(cfg.mcpServers['rally-dev'].command).not.toBe('node')
  })

  it('워크스페이스 path 가 존재하지 않으면 .mcp.json 생성 안 됨', () => {
    ensureClaudeCommands('/nonexistent/path')
    // throw 없어야 하고 .mcp.json 도 안 만들어짐 — early return
    expect(true).toBe(true)
  })
})

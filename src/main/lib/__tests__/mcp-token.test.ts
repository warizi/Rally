/**
 * mcp-token.ts 단위 테스트.
 * 보안-2 Phase 1.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  generateMcpToken,
  ensureMcpToken,
  rotateMcpToken,
  _resetMcpTokenCacheForTests
} from '../mcp-token'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'rally-mcp-token-'))
  _resetMcpTokenCacheForTests()
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
  _resetMcpTokenCacheForTests()
})

function tokenPathInTmp(): string {
  return join(tmpDir, '.mcp-token')
}

describe('generateMcpToken', () => {
  it('returns 64-char lowercase hex (256bit)', () => {
    const token = generateMcpToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns different tokens on each call (crypto random)', () => {
    const tokens = new Set([
      generateMcpToken(),
      generateMcpToken(),
      generateMcpToken(),
      generateMcpToken(),
      generateMcpToken()
    ])
    expect(tokens.size).toBe(5)
  })
})

describe('ensureMcpToken', () => {
  it('creates token file on first call', () => {
    const path = tokenPathInTmp()
    const token = ensureMcpToken({ tokenPath: path })
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(readFileSync(path, 'utf-8')).toBe(token)
  })

  it('persists with 0600 permission on Unix', () => {
    if (process.platform === 'win32') return
    const path = tokenPathInTmp()
    ensureMcpToken({ tokenPath: path })
    const mode = statSync(path).mode & 0o777
    expect(mode).toBe(0o600)
  })

  it('returns existing token on subsequent calls (cache hit)', () => {
    const path = tokenPathInTmp()
    const first = ensureMcpToken({ tokenPath: path })
    const second = ensureMcpToken({ tokenPath: path })
    expect(second).toBe(first)
  })

  it('reads existing valid token from disk after cache reset', () => {
    const path = tokenPathInTmp()
    const first = ensureMcpToken({ tokenPath: path })
    _resetMcpTokenCacheForTests()
    const second = ensureMcpToken({ tokenPath: path })
    expect(second).toBe(first)
  })

  it('regenerates token when file content is corrupted', () => {
    const path = tokenPathInTmp()
    writeFileSync(path, 'not-a-valid-hex-token-too-short', 'utf-8')
    const token = ensureMcpToken({ tokenPath: path })
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(token).not.toBe('not-a-valid-hex-token-too-short')
  })

  it('creates parent directory if missing', () => {
    const nestedPath = join(tmpDir, 'nested', 'sub', '.mcp-token')
    const token = ensureMcpToken({ tokenPath: nestedPath })
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(readFileSync(nestedPath, 'utf-8')).toBe(token)
  })
})

describe('rotateMcpToken', () => {
  it('always returns a new token different from previous', () => {
    const path = tokenPathInTmp()
    const original = ensureMcpToken({ tokenPath: path })
    const rotated = rotateMcpToken({ tokenPath: path })
    expect(rotated).not.toBe(original)
    expect(rotated).toMatch(/^[0-9a-f]{64}$/)
  })

  it('updates disk file with new token', () => {
    const path = tokenPathInTmp()
    ensureMcpToken({ tokenPath: path })
    const rotated = rotateMcpToken({ tokenPath: path })
    expect(readFileSync(path, 'utf-8')).toBe(rotated)
  })

  it('updates cache so next ensure returns rotated value', () => {
    const path = tokenPathInTmp()
    ensureMcpToken({ tokenPath: path })
    const rotated = rotateMcpToken({ tokenPath: path })
    expect(ensureMcpToken({ tokenPath: path })).toBe(rotated)
  })

  it('preserves 0600 permission on Unix', () => {
    if (process.platform === 'win32') return
    const path = tokenPathInTmp()
    ensureMcpToken({ tokenPath: path })
    rotateMcpToken({ tokenPath: path })
    const mode = statSync(path).mode & 0o777
    expect(mode).toBe(0o600)
  })
})

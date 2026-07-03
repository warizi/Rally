/**
 * 위험 IPC 채널 zod 스키마 단위 테스트.
 *
 * 보안-1 Phase 3 — 검증된 입력만 service 까지 도달하도록 보장.
 */
import { describe, it, expect } from 'vitest'
import { zipPathSchema, workspaceNameSchema, workspacePathSchema } from '../schemas'

describe('zipPathSchema (backup:import / readManifest)', () => {
  it('accepts .zip path', () => {
    expect(() => zipPathSchema.parse('/Users/me/backup.zip')).not.toThrow()
    expect(() => zipPathSchema.parse('backup.ZIP')).not.toThrow() // 대소문자 무관
  })

  it('rejects non-zip extension', () => {
    expect(() => zipPathSchema.parse('/Users/me/backup.tar')).toThrow(/\.zip/)
    expect(() => zipPathSchema.parse('/Users/me/file.txt')).toThrow()
  })

  it('rejects path traversal', () => {
    expect(() => zipPathSchema.parse('../../etc/passwd.zip')).toThrow(/traversal/)
    expect(() => zipPathSchema.parse('foo/../bar.zip')).toThrow(/traversal/)
  })
})

describe('workspaceNameSchema (workspace:create name)', () => {
  it('accepts normal names', () => {
    expect(workspaceNameSchema.parse('My Workspace')).toBe('My Workspace')
    expect(workspaceNameSchema.parse('  trimmed  ')).toBe('trimmed')
  })

  it('rejects empty / whitespace-only', () => {
    expect(() => workspaceNameSchema.parse('')).toThrow()
    expect(() => workspaceNameSchema.parse('   ')).toThrow()
  })

  it('rejects too long (> 255 chars)', () => {
    expect(() => workspaceNameSchema.parse('a'.repeat(256))).toThrow()
  })
})

describe('workspacePathSchema (workspace:create path)', () => {
  it('accepts normal paths', () => {
    expect(() => workspacePathSchema.parse('/Users/me/Documents/Workspace')).not.toThrow()
    expect(() => workspacePathSchema.parse('C:\\Users\\me\\Workspace')).not.toThrow()
  })

  it('rejects path traversal', () => {
    expect(() => workspacePathSchema.parse('/Users/me/../other')).toThrow(/traversal/)
  })

  it('rejects empty', () => {
    expect(() => workspacePathSchema.parse('')).toThrow()
  })

  it('rejects absurdly long paths (>4096)', () => {
    expect(() => workspacePathSchema.parse('/'.repeat(4097))).toThrow()
  })
})

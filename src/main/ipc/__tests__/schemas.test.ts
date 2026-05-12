/**
 * 위험 IPC 채널 zod 스키마 단위 테스트.
 *
 * 보안-1 Phase 3 — 검증된 입력만 service 까지 도달하도록 보장.
 */
import { describe, it, expect } from 'vitest'
import {
  zipPathSchema,
  terminalCreateSchema,
  workspaceNameSchema,
  workspacePathSchema
} from '../schemas'

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

describe('terminalCreateSchema (terminal:create)', () => {
  const validInput = {
    workspaceId: 'abcdefghijk1234567890',
    cwd: '/Users/me/workspace',
    cols: 80,
    rows: 24
  }

  it('accepts minimal valid input', () => {
    expect(() => terminalCreateSchema.parse(validInput)).not.toThrow()
  })

  it('accepts all optional fields', () => {
    expect(() =>
      terminalCreateSchema.parse({
        ...validInput,
        shell: '/bin/zsh',
        id: 'xyz12345abcdefghijklm',
        sortOrder: 3
      })
    ).not.toThrow()
  })

  it('rejects path traversal in cwd', () => {
    expect(() => terminalCreateSchema.parse({ ...validInput, cwd: '../../../etc' })).toThrow(
      /traversal/
    )
  })

  it('rejects shell with NUL byte (process arg injection 차단)', () => {
    expect(() => terminalCreateSchema.parse({ ...validInput, shell: '/bin/zsh\0evil' })).toThrow(
      /NUL/
    )
  })

  it('rejects unreasonably long shell name', () => {
    expect(() => terminalCreateSchema.parse({ ...validInput, shell: 'a'.repeat(256) })).toThrow()
  })

  it('rejects negative or zero cols/rows', () => {
    expect(() => terminalCreateSchema.parse({ ...validInput, cols: 0 })).toThrow()
    expect(() => terminalCreateSchema.parse({ ...validInput, rows: -1 })).toThrow()
  })

  it('rejects absurd cols/rows (resource exhaustion 차단)', () => {
    expect(() => terminalCreateSchema.parse({ ...validInput, cols: 100000 })).toThrow()
  })

  it('rejects non-integer cols/rows', () => {
    expect(() => terminalCreateSchema.parse({ ...validInput, cols: 80.5 })).toThrow()
  })

  it('rejects invalid workspaceId format', () => {
    expect(() => terminalCreateSchema.parse({ ...validInput, workspaceId: 'has space' })).toThrow()
    expect(() => terminalCreateSchema.parse({ ...validInput, workspaceId: 'short' })).toThrow()
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

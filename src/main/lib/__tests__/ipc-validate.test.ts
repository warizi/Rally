/**
 * validateIpc / validateIpcAsync + 공용 스키마 단위 테스트.
 *
 * 보안-1 Phase 1 진입 게이트.
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  validateIpc,
  validateIpcAsync,
  idSchema,
  nanoidSchema,
  safePathSchema,
  nonEmptyStringSchema
} from '../ipc-validate'

const noopEvent = null as never

describe('validateIpc (sync)', () => {
  it('passes valid arguments to handler and wraps result as success', () => {
    const handler = validateIpc([z.string(), z.number()], (s, n) => `${s}-${n}`)
    const res = handler(noopEvent, 'abc', 42)
    expect(res).toEqual({ success: true, data: 'abc-42' })
  })

  it('rejects when first arg has wrong type → ErrorResponse', () => {
    const handler = validateIpc([z.string()], (s) => s)
    const res = handler(noopEvent, 123)
    expect(res.success).toBe(false)
    expect(res.message).toMatch(/string/i)
  })

  it('rejects when second arg has wrong type → ErrorResponse', () => {
    const handler = validateIpc([z.string(), z.number()], (a, b) => `${a}${b}`)
    const res = handler(noopEvent, 'ok', 'not-number')
    expect(res.success).toBe(false)
  })

  it('rejects when arg count short (missing args parse as undefined)', () => {
    const handler = validateIpc([z.string(), z.string()], (a, b) => `${a}${b}`)
    const res = handler(noopEvent, 'only-one')
    expect(res.success).toBe(false)
  })

  it('handler can return complex object', () => {
    const handler = validateIpc([z.string()], (id) => ({ id, count: 1 }))
    const res = handler(noopEvent, 'foo')
    expect(res).toEqual({ success: true, data: { id: 'foo', count: 1 } })
  })

  it('handler errors are wrapped (not validation errors)', () => {
    const handler = validateIpc([z.string()], () => {
      throw new Error('service error')
    })
    const res = handler(noopEvent, 'ok')
    expect(res.success).toBe(false)
    expect(res.message).toBe('service error')
  })
})

describe('validateIpcAsync', () => {
  it('passes valid args to async handler', async () => {
    const handler = validateIpcAsync([z.string()], async (s) => `${s}!`)
    const res = await handler(noopEvent, 'hi')
    expect(res).toEqual({ success: true, data: 'hi!' })
  })

  it('rejects invalid args (does not call handler)', async () => {
    let called = false
    const handler = validateIpcAsync([z.string()], async () => {
      called = true
    })
    const res = await handler(noopEvent, 999)
    expect(called).toBe(false)
    expect(res.success).toBe(false)
  })

  it('wraps async handler rejection', async () => {
    const handler = validateIpcAsync([z.string()], async () => {
      throw new Error('async failure')
    })
    const res = await handler(noopEvent, 'ok')
    expect(res.success).toBe(false)
    expect(res.message).toBe('async failure')
  })
})

describe('nanoidSchema / idSchema', () => {
  it('accepts URL-safe alphanumeric (21-char default nanoid)', () => {
    expect(() => nanoidSchema.parse('V1StGXR8_Z5jdHi6B-myT')).not.toThrow()
  })

  it('accepts custom length within bounds', () => {
    expect(() => nanoidSchema.parse('abc12345')).not.toThrow() // 8 chars
  })

  it('rejects too short', () => {
    expect(() => nanoidSchema.parse('abc')).toThrow()
  })

  it('rejects invalid characters (spaces, slashes)', () => {
    expect(() => nanoidSchema.parse('has space')).toThrow()
    expect(() => nanoidSchema.parse('has/slash')).toThrow()
    expect(() => nanoidSchema.parse('has.dot.id')).toThrow()
  })

  it('idSchema === nanoidSchema (alias)', () => {
    expect(idSchema).toBe(nanoidSchema)
  })
})

describe('safePathSchema (path traversal 차단)', () => {
  it('accepts plain absolute / relative paths', () => {
    expect(() => safePathSchema.parse('/Users/me/Documents/file.txt')).not.toThrow()
    expect(() => safePathSchema.parse('workspace/note.md')).not.toThrow()
    expect(() => safePathSchema.parse('C:\\Users\\me\\file.txt')).not.toThrow()
  })

  it('rejects ".." segment (forward slash)', () => {
    expect(() => safePathSchema.parse('../etc/passwd')).toThrow(/traversal/)
    expect(() => safePathSchema.parse('foo/../bar')).toThrow(/traversal/)
  })

  it('rejects ".." segment (backslash)', () => {
    expect(() => safePathSchema.parse('..\\Windows\\System32')).toThrow(/traversal/)
    expect(() => safePathSchema.parse('foo\\..\\bar')).toThrow(/traversal/)
  })

  it('does not reject filenames that merely contain ".." as substring (e.g. "..jpg")', () => {
    // ".." 는 segment 단위로만 차단 — 파일명 일부로 들어간 ".." 는 OK
    expect(() => safePathSchema.parse('foo..jpg')).not.toThrow()
    expect(() => safePathSchema.parse('weird..name.txt')).not.toThrow()
  })

  it('rejects empty string', () => {
    expect(() => safePathSchema.parse('')).toThrow()
  })
})

describe('nonEmptyStringSchema', () => {
  it('accepts non-empty trimmed string', () => {
    expect(nonEmptyStringSchema.parse('hello')).toBe('hello')
    expect(nonEmptyStringSchema.parse('  hello  ')).toBe('hello')
  })

  it('rejects empty / whitespace-only', () => {
    expect(() => nonEmptyStringSchema.parse('')).toThrow()
    expect(() => nonEmptyStringSchema.parse('   ')).toThrow()
  })
})

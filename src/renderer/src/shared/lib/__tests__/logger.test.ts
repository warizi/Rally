/**
 * shared/lib/logger.test.ts
 */
import { describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const errorMock = vi.fn()
  const scopeMock = vi.fn(() => ({ error: errorMock }))
  return { errorMock, scopeMock }
})

vi.mock('electron-log/renderer', () => ({
  default: {
    scope: mocks.scopeMock,
    error: vi.fn()
  }
}))

const { errorMock, scopeMock } = mocks

import { logger, scoped, toLogError } from '../logger'

describe('logger', () => {
  it('logger 는 electron-log default export 와 동일', () => {
    expect(logger).toBeDefined()
    expect(typeof logger.scope).toBe('function')
  })

  it('scoped(name) → log.scope(name) 호출', () => {
    scopeMock.mockClear()
    scoped('foo')
    expect(scopeMock).toHaveBeenCalledWith('foo')
  })
})

describe('toLogError', () => {
  it('catch handler 형식 — scope.error 호출', () => {
    scopeMock.mockClear()
    errorMock.mockClear()
    const handler = toLogError('test-scope')
    handler(new Error('boom'))
    expect(scopeMock).toHaveBeenCalledWith('test-scope')
    expect(errorMock).toHaveBeenCalledTimes(1)
    expect(errorMock.mock.calls[0][0]).toBeInstanceOf(Error)
  })

  it('동일 scope 재호출 — 새 error 도 logging', () => {
    errorMock.mockClear()
    const handler = toLogError('s')
    handler('first')
    handler('second')
    expect(errorMock).toHaveBeenCalledTimes(2)
  })
})

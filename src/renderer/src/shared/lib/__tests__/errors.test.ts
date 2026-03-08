import { describe, expect, it } from 'vitest'
import { NotFoundError, ValidationError, ConflictError } from '../errors'

describe('NotFoundError', () => {
  it('name이 NotFoundError이다', () => {
    const error = new NotFoundError('찾을 수 없음')
    expect(error.name).toBe('NotFoundError')
    expect(error.message).toBe('찾을 수 없음')
    expect(error instanceof Error).toBe(true)
  })
})

describe('ValidationError', () => {
  it('name이 ValidationError이다', () => {
    const error = new ValidationError('유효하지 않음')
    expect(error.name).toBe('ValidationError')
    expect(error.message).toBe('유효하지 않음')
    expect(error instanceof Error).toBe(true)
  })
})

describe('ConflictError', () => {
  it('name이 ConflictError이다', () => {
    const error = new ConflictError('충돌 발생')
    expect(error.name).toBe('ConflictError')
    expect(error.message).toBe('충돌 발생')
    expect(error instanceof Error).toBe(true)
  })
})

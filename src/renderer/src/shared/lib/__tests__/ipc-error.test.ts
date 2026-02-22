import { describe, expect, it } from 'vitest'
import { throwIpcError } from '../ipc-error'
import { NotFoundError, ValidationError, ConflictError } from '../errors'

describe('throwIpcError', () => {
  it('NotFoundError를 던진다', () => {
    expect(() =>
      throwIpcError({ success: false, message: '없음', errorType: 'NotFoundError' })
    ).toThrow(NotFoundError)
  })

  it('ValidationError를 던진다', () => {
    expect(() =>
      throwIpcError({ success: false, message: '유효하지 않음', errorType: 'ValidationError' })
    ).toThrow(ValidationError)
  })

  it('ConflictError를 던진다', () => {
    expect(() =>
      throwIpcError({ success: false, message: '충돌', errorType: 'ConflictError' })
    ).toThrow(ConflictError)
  })

  it('알 수 없는 에러는 기본 Error를 던진다', () => {
    expect(() =>
      throwIpcError({ success: false, message: '알 수 없음', errorType: 'UnknownError' })
    ).toThrow(Error)
  })

  it('message가 없으면 기본 메시지를 사용한다', () => {
    expect(() => throwIpcError({ success: false, errorType: 'UnknownError' })).toThrow(
      '알 수 없는 오류가 발생했습니다'
    )
  })
})

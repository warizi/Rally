import type { IpcResponse } from '@shared/types/ipc'
import { NotFoundError, ValidationError, ConflictError } from './errors'

export function throwIpcError(res: IpcResponse): never {
  const message = res.message ?? '알 수 없는 오류가 발생했습니다'
  switch (res.errorType) {
    case 'NotFoundError':
      throw new NotFoundError(message)
    case 'ValidationError':
      throw new ValidationError(message)
    case 'ConflictError':
      throw new ConflictError(message)
    default:
      throw new Error(message)
  }
}

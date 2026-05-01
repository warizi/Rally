import { ErrorCode, normalizeError } from './errors'

export type ErrorType =
  | 'NotFoundError'
  | 'ValidationError'
  | 'ConflictError'
  | 'PayloadTooLargeError'
  | 'WorkspaceInactiveError'
  | 'PermissionError'
  | 'UnknownError'

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  /** stable code for branching (ErrorCode enum). 신규 호출자는 이 필드를 우선 사용. */
  code?: ErrorCode
  /** legacy 호환 — 기존 호출자 보호용. 새 코드는 `code` 사용 권장. */
  errorType?: ErrorType
  details?: Record<string, unknown>
}

export function successResponse<T>(data: T): IpcResponse<T> {
  return { success: true, data }
}

export function errorResponse(error: unknown): IpcResponse<never> {
  const normalized = normalizeError(error)
  return {
    success: false,
    message: normalized.message,
    code: normalized.code,
    errorType: normalized.name as ErrorType,
    ...(normalized.details ? { details: normalized.details } : {})
  }
}

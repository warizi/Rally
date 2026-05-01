/** Stable error code (main process ErrorCode enum과 1:1 대응) */
export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'WORKSPACE_INACTIVE'
  | 'PERMISSION'
  | 'INTERNAL'

/** Legacy 호환 필드 — 새 호출자는 `code` 우선 사용 */
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
  /** stable code (preferred for branching) */
  code?: ErrorCode
  /** legacy 호환 */
  errorType?: ErrorType
  details?: Record<string, unknown>
}

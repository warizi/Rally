export type ErrorType = 'NotFoundError' | 'ValidationError' | 'ConflictError' | 'UnknownError'

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errorType?: ErrorType
}

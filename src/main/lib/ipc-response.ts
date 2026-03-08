export type ErrorType = 'NotFoundError' | 'ValidationError' | 'ConflictError' | 'UnknownError'

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errorType?: ErrorType
}

export function successResponse<T>(data: T): IpcResponse<T> {
  return { success: true, data }
}

export function errorResponse(error: unknown): IpcResponse<never> {
  if (error instanceof Error) {
    const errorType: ErrorType =
      error.name === 'NotFoundError'
        ? 'NotFoundError'
        : error.name === 'ValidationError'
          ? 'ValidationError'
          : error.name === 'ConflictError'
            ? 'ConflictError'
            : 'UnknownError'
    return { success: false, message: error.message, errorType }
  }
  return { success: false, message: String(error), errorType: 'UnknownError' }
}

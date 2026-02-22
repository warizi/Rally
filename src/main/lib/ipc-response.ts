export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
}

export function successResponse<T>(data: T): IpcResponse<T> {
  return { success: true, data }
}

export function errorResponse(error: unknown): IpcResponse<never> {
  if (error instanceof Error) {
    return { success: false, message: error.message }
  }
  return { success: false, message: String(error) }
}

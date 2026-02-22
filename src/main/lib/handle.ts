import { errorResponse, IpcResponse, successResponse } from './ipc-response'

export function handle<T>(fn: () => T): IpcResponse<T> | IpcResponse<never> {
  try {
    return successResponse(fn())
  } catch (e) {
    return errorResponse(e)
  }
}

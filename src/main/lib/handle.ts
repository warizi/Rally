import { errorResponse, IpcResponse, successResponse } from './ipc-response'

export function handle<T>(fn: () => T): IpcResponse<T> | IpcResponse<never> {
  try {
    return successResponse(fn())
  } catch (e) {
    return errorResponse(e)
  }
}

export async function handleAsync<T>(
  fn: () => Promise<T>
): Promise<IpcResponse<T> | IpcResponse<never>> {
  try {
    return successResponse(await fn())
  } catch (e) {
    return errorResponse(e)
  }
}

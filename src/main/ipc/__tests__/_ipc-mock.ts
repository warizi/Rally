/**
 * IPC 핸들러 테스트 공용 helper.
 *
 * `ipcMain.handle` 와 `ipcMain.on` 호출을 가로채 channel -> handler 로 모은다.
 * 테스트는 `getHandler(channel)` 로 핸들러를 꺼내 직접 호출 후 결과를 검증.
 *
 * 사용:
 * ```ts
 * import { setupIpcCapture, ipcHandlers } from './_ipc-mock'
 * setupIpcCapture() // vi.mock('electron', ...) 보다 먼저 import 되어야 vi.hoisted 동작
 * ```
 */
import { vi } from 'vitest'

export const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>()

export function getHandler<T = unknown>(channel: string): (...args: unknown[]) => T | Promise<T> {
  const fn = ipcHandlers.get(channel)
  if (!fn) throw new Error(`No handler registered for channel: ${channel}`)
  return fn as (...args: unknown[]) => T | Promise<T>
}

/** ipcHandlers 에 채우는 ipcMain mock 객체. vi.mock factory 안에서 사용. */
export function makeIpcMainMock(): {
  ipcMain: { handle: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> }
} {
  return {
    ipcMain: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        ipcHandlers.set(channel, fn)
      }),
      on: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        ipcHandlers.set(channel, fn)
      })
    }
  }
}

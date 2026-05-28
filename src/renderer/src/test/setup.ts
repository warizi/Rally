import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// electron-log/renderer 의 console transport 가 `setTimeout` 으로 로그를 queue 하는
// 구조라 `vi.useFakeTimers()` 와 결합 시 워커가 hang. 테스트 전용 no-op mock.
vi.mock('electron-log/renderer', () => {
  const noop = (): void => {}
  type Logger = {
    error: typeof noop
    warn: typeof noop
    info: typeof noop
    verbose: typeof noop
    debug: typeof noop
    silly: typeof noop
    log: typeof noop
    scope: () => Logger
  }
  const make = (): Logger => ({
    error: noop,
    warn: noop,
    info: noop,
    verbose: noop,
    debug: noop,
    silly: noop,
    log: noop,
    scope: () => make()
  })
  const stub = make()
  return { default: stub, ...stub }
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  // window.api / electron / shell 잔존 제거 (테스트 간 격리)
  delete (window as unknown as Record<string, unknown>).api
  delete (window as unknown as Record<string, unknown>).electron
  delete (window as unknown as Record<string, unknown>).shell
})

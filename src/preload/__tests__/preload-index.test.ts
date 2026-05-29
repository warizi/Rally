/**
 * preload/index.ts 모듈 초기화 테스트.
 *
 * import 시점에 실행되는 부트스트랩 로직 (contextBridge.exposeInMainWorld 등) 검증.
 * api-surface.test.ts 는 텍스트 정적 분석, 본 테스트는 실제 런타임 실행 경로.
 */
import { describe, it, expect, vi } from 'vitest'

const { exposeInMainWorldMock, initTerminalListenersMock } = vi.hoisted(() => ({
  exposeInMainWorldMock: vi.fn(),
  initTerminalListenersMock: vi.fn()
}))

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: exposeInMainWorldMock }
}))
vi.mock('@electron-toolkit/preload', () => ({
  electronAPI: { __fake: 'electronAPI' }
}))
vi.mock('../lib/terminal-listeners', () => ({
  initTerminalListeners: initTerminalListenersMock
}))
vi.mock('../apis', () => ({
  api: { __fake: 'api' },
  shellApi: { __fake: 'shellApi' }
}))

// preload/index.ts 는 process.contextIsolated 분기. 테스트 환경에서는 undefined 일 수 있어
// 명시적으로 true 로 두고 contextBridge 경로 실행.
Object.defineProperty(process, 'contextIsolated', { value: true, configurable: true })

describe('preload/index.ts 부트스트랩', () => {
  it('import 시 initTerminalListeners + contextBridge.exposeInMainWorld 3회 호출', async () => {
    await import('../index')

    expect(initTerminalListenersMock).toHaveBeenCalled()
    // 'electron' / 'api' / 'shell' 3개 노출
    const exposed = exposeInMainWorldMock.mock.calls.map((c) => c[0])
    expect(exposed.sort()).toEqual(['api', 'electron', 'shell'])
  })
})

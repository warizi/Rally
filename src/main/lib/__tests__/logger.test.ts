/**
 * logger 테스트 환경 동작 검증.
 *
 * 테스트(vitest)에서는 electron-log 파일 transport 가 꺼져 있어야 한다.
 * 켜져 있으면 sandbox/CI 에서 ~/Library/Logs/rally 쓰기 시 EPERM stderr 노이즈가
 * 발생하고, 테스트가 사용자 로그 파일을 건드린다. console 은 유지(의도된 경고 노출).
 */
import { describe, it, expect } from 'vitest'
import { logger, scoped } from '../logger'

describe('logger (test 환경)', () => {
  it('파일 transport 가 비활성화되어 있다 (sandbox EPERM 방지)', () => {
    expect(logger.transports.file.level).toBe(false)
  })

  it('console transport 는 유지된다 (의도된 경고는 계속 출력)', () => {
    expect(logger.transports.console.level).not.toBe(false)
  })

  it('scoped 는 파일 쓰기 없이 동작한다 (throw 하지 않음)', () => {
    const log = scoped('test-scope')
    expect(() => log.info('no file write in test')).not.toThrow()
  })
})

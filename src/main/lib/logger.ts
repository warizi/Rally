import log from 'electron-log/main'

// log.initialize() 가 main 측 IPC 핸들러를 설치하여
// renderer 의 `electron-log/renderer` 가 자동으로 main 으로 forward 된다.
log.initialize()

// `@electron-toolkit/utils` 의 `is.dev` 를 직접 import 하면
// node 테스트 환경에서 electron 의 named export 가 없다며 실패하므로
// NODE_ENV 로 직접 판단 (electron.app.isPackaged 도 main process only).
const isDev = process.env.NODE_ENV !== 'production'
// 테스트 환경(vitest)에서는 파일 transport 를 끈다. electron-log 는 기본적으로
// `app.getPath('logs')`(~/Library/Logs/rally 등)에 쓰는데, sandbox/CI 에서는 EPERM
// stderr 노이즈가 나고 테스트가 사용자 로그 파일을 건드릴 이유도 없다. console 은
// 그대로 둬서 의도된 경고는 계속 보이게 한다.
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST
log.transports.console.level = isDev ? 'debug' : 'info'
log.transports.file.level = isTest ? false : 'info'
log.transports.file.maxSize = 1024 * 1024 // 1MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}'
log.transports.console.format = '[{h}:{i}:{s}] [{level}]{scope} {text}'

export const logger = log
export const scoped = (scope: string): ReturnType<typeof log.scope> => log.scope(scope)

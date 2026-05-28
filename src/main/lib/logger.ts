import log from 'electron-log/main'
import { is } from '@electron-toolkit/utils'

// log.initialize() 가 main 측 IPC 핸들러를 설치하여
// renderer 의 `electron-log/renderer` 가 자동으로 main 으로 forward 된다.
log.initialize()

log.transports.console.level = is.dev ? 'debug' : 'info'
log.transports.file.level = 'info'
log.transports.file.maxSize = 1024 * 1024 // 1MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}'
log.transports.console.format = '[{h}:{i}:{s}] [{level}]{scope} {text}'

export const logger = log
export const scoped = (scope: string): ReturnType<typeof log.scope> => log.scope(scope)

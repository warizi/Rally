import log from 'electron-log/renderer'

export const logger = log

export const scoped = (scope: string): ReturnType<typeof log.scope> => log.scope(scope)

/**
 * `.catch(toLogError('scope'))` 형태로 fire-and-forget 에러 로깅 시 사용.
 */
export const toLogError =
  (scope: string) =>
  (err: unknown): void => {
    log.scope(scope).error(err)
  }

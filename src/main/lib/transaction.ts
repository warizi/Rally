import { db } from '../db'

/**
 * better-sqlite3 동기 트랜잭션 래퍼.
 * fn 내부에서 throw 발생 시 자동 ROLLBACK, 성공 시 COMMIT.
 *
 * 주의:
 * - fn은 반드시 동기. async/await 사용 시 트랜잭션이 즉시 종료되어 보장 깨짐.
 * - 파일 IO 같은 외부 부수효과는 트랜잭션 밖에서 별도 보상 처리 필요.
 *
 * 예시:
 *   const result = withTransaction(() => {
 *     const a = repo.create(...)
 *     const b = repo.create(...)
 *     return { a, b }
 *   })
 */
export function withTransaction<T>(fn: () => T): T {
  return db.$client.transaction(fn)()
}

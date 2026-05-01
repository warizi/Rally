import { ValidationError } from './errors'
import { withTransaction } from './transaction'

export interface ProcessBatchOptions {
  /** 트랜잭션 래핑 여부 (기본 true). FS+DB 혼합 작업에선 false 권장. */
  transactional?: boolean
  /** 한 번에 처리할 수 있는 최대 액션 개수 (기본 100). 초과 시 ValidationError. */
  maxSize?: number
}

/**
 * batch 라우트의 공통 처리 로직.
 * - actions 배열 검증 (빈 배열 거부 + maxSize 제한)
 * - 순차 실행 + try/catch
 * - 실패 시 ValidationError 던지면서 failedActionIndex / completedCount 메타 첨부
 * - transactional: true면 db.$client.transaction으로 감싸 전체 rollback
 *
 * 모든 액션이 성공하면 처리된 결과 배열 반환.
 */
export function processBatchActions<TAction, TResult>(
  actions: TAction[],
  processor: (action: TAction, index: number) => TResult,
  options: ProcessBatchOptions = {}
): TResult[] {
  const { transactional = true, maxSize = 100 } = options

  if (!Array.isArray(actions) || actions.length === 0) {
    throw new ValidationError('actions array is required')
  }
  if (actions.length > maxSize) {
    throw new ValidationError(
      `Batch size ${actions.length} exceeds limit ${maxSize}. Split into smaller batches.`
    )
  }

  const run = (): TResult[] => {
    const results: TResult[] = []
    for (const [i, action] of actions.entries()) {
      try {
        results.push(processor(action, i))
      } catch (e) {
        throw new ValidationError((e as Error).message, {
          failedActionIndex: i,
          completedCount: results.length
        })
      }
    }
    return results
  }

  return transactional ? withTransaction(run) : run()
}

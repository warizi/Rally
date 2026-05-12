import { NotFoundError } from '../../../lib/errors'
import { todoRepository } from '../../../repositories/todo'
import { emptyCollected, type CollectedRows } from '../cascade-collector'
import type { SoftDeleteHandler } from './handler.interface'

/**
 * todo cascade — 부모 todo 삭제 시 모든 후손 todo 함께 trash.
 *
 * findAllDescendantIds 가 재귀적으로 자식들의 자식까지 모두 수집.
 */
export const todoHandler: SoftDeleteHandler<'todo'> = {
  entityType: 'todo',

  collectCascade(rootId: string): CollectedRows {
    const root = todoRepository.findByIdIncludingDeleted(rootId)
    if (!root) throw new NotFoundError(`Todo not found: ${rootId}`)
    const descendantIds = todoRepository.findAllDescendantIds(rootId, { includeDeleted: true })
    return {
      ...emptyCollected(),
      todoIds: [rootId, ...descendantIds],
      rootTitle: root.title
    }
  }
}

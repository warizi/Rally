import { NotFoundError } from '../../../lib/errors'
import { scheduleRepository } from '../../../repositories/schedule'
import { emptyCollected, type CollectedRows } from '../cascade-collector'
import type { SoftDeleteHandler } from './handler.interface'

/** schedule — 단일 row, cascade 없음 */
export const scheduleHandler: SoftDeleteHandler<'schedule'> = {
  entityType: 'schedule',

  collectCascade(rootId: string): CollectedRows {
    const row = scheduleRepository.findByIdIncludingDeleted(rootId)
    if (!row) throw new NotFoundError(`Schedule not found: ${rootId}`)
    return { ...emptyCollected(), scheduleIds: [rootId], rootTitle: row.title }
  }
}

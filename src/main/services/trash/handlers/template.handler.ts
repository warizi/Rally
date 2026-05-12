import { NotFoundError } from '../../../lib/errors'
import { templateRepository } from '../../../repositories/template'
import { emptyCollected, type CollectedRows } from '../cascade-collector'
import type { SoftDeleteHandler } from './handler.interface'

/** template — 단일 row */
export const templateHandler: SoftDeleteHandler<'template'> = {
  entityType: 'template',

  collectCascade(rootId: string): CollectedRows {
    const row = templateRepository.findByIdIncludingDeleted(rootId)
    if (!row) throw new NotFoundError(`Template not found: ${rootId}`)
    return { ...emptyCollected(), templateIds: [rootId], rootTitle: row.title }
  }
}

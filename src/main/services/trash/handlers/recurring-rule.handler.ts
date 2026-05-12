import { NotFoundError } from '../../../lib/errors'
import { recurringRuleRepository } from '../../../repositories/recurring-rule'
import { emptyCollected, type CollectedRows } from '../cascade-collector'
import type { SoftDeleteHandler } from './handler.interface'

/** recurring_rule — 단일 row */
export const recurringRuleHandler: SoftDeleteHandler<'recurring_rule'> = {
  entityType: 'recurring_rule',

  collectCascade(rootId: string): CollectedRows {
    const row = recurringRuleRepository.findByIdIncludingDeleted(rootId)
    if (!row) throw new NotFoundError(`Recurring rule not found: ${rootId}`)
    return { ...emptyCollected(), recurringRuleIds: [rootId], rootTitle: row.title }
  }
}

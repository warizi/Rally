import { NotFoundError } from '../../../lib/errors'
import { customSkillRepository } from '../../../repositories/custom-skill'
import { emptyCollected, type CollectedRows } from '../cascade-collector'
import type { SoftDeleteHandler } from './handler.interface'

/**
 * custom_skill — 단일 row, cascade 없음.
 *
 * customSkills 는 워크스페이스 무관 전역 엔티티지만 trash_batches 는 워크스페이스 스코프라
 * "삭제 발생 시점 활성 워크스페이스" 에 귀속된다. 복구·영구삭제는 그 워크스페이스의 휴지통에서
 * 수행하지만, 활성화된 skill 자체는 전체 워크스페이스에 동일하게 보인다.
 */
export const customSkillHandler: SoftDeleteHandler<'custom_skill'> = {
  entityType: 'custom_skill',

  collectCascade(rootId: string): CollectedRows {
    const row = customSkillRepository.findById(rootId)
    if (!row) throw new NotFoundError(`Custom skill not found: ${rootId}`)
    return { ...emptyCollected(), customSkillIds: [rootId], rootTitle: row.name }
  }
}

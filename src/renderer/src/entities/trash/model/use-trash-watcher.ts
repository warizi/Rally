import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * MainLayout에서 호출 — main 프로세스의 'trash:changed' 브로드캐스트를 듣고
 * trash list/count 캐시를 무효화. 또한 다른 도메인(note/csv/pdf/image/folder/todo/canvas/schedule/recurring)
 * 의 active list도 무효화 — soft delete가 막 일어났거나 복구가 일어났기 때문.
 */
export function useTrashWatcher(): void {
  const qc = useQueryClient()
  useEffect(() => {
    const unsub = window.api.trash.onChanged(() => {
      qc.invalidateQueries({ queryKey: ['trash'] })
      // 활성 도메인 리스트 — soft delete된 row가 사라지거나, 복구 시 다시 등장
      qc.invalidateQueries({ queryKey: ['note'] })
      qc.invalidateQueries({ queryKey: ['csv'] })
      qc.invalidateQueries({ queryKey: ['pdf'] })
      qc.invalidateQueries({ queryKey: ['image'] })
      qc.invalidateQueries({ queryKey: ['folder'] })
      qc.invalidateQueries({ queryKey: ['todo'] })
      qc.invalidateQueries({ queryKey: ['canvas'] })
      qc.invalidateQueries({ queryKey: ['schedule'] })
      qc.invalidateQueries({ queryKey: ['recurringRule'] })
      // entity-link: trashService.softRemove가 link row를 hard delete하고 restore가 재삽입.
      // 다른 entity (예: 노트)에서 보고 있는 linkedItems도 같이 갱신돼야 함.
      qc.invalidateQueries({ queryKey: ['entityLink'] })
      // history도 entity-link 의존이라 함께 무효화
      qc.invalidateQueries({ queryKey: ['history'] })
    })
    return unsub
  }, [qc])
}

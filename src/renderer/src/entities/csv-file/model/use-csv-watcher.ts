import { Sheet } from 'lucide-react'
import { useFileWatcher } from '@shared/hooks/use-file-watcher'
import { isOwnWrite } from './own-write-tracker'

/** 외부 파일 변경 시 발생하는 커스텀 이벤트 이름 */
export const CSV_EXTERNAL_CHANGED_EVENT = 'csv:external-changed'

/** MainLayout에서 호출 — csv:changed push 이벤트 구독 + React Query invalidation */
export function useCsvWatcher(): void {
  useFileWatcher({
    onChanged: window.api.csv.onChanged,
    queryKeyPrefix: 'csv',
    icon: Sheet,
    externalChangedEvent: CSV_EXTERNAL_CHANGED_EVENT,
    idField: 'csvId',
    isOwnWrite
  })
}

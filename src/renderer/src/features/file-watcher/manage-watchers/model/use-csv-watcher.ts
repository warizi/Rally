import { Sheet } from 'lucide-react'
import { ROUTES } from '@shared/constants/tab-url'
import { isOwnWrite, CSV_EXTERNAL_CHANGED_EVENT } from '@entities/csv-file'
import { useFileWatcher } from '../lib/use-file-watcher'

/** MainLayout에서 호출 — csv:changed push 이벤트 구독 + React Query invalidation */
export function useCsvWatcher(): void {
  useFileWatcher({
    onChanged: window.api.csv.onChanged,
    queryKeyPrefix: 'csv',
    icon: Sheet,
    externalChangedEvent: CSV_EXTERNAL_CHANGED_EVENT,
    idField: 'csvId',
    isOwnWrite,
    buildTabOptions: (item) => ({
      type: 'csv',
      pathname: ROUTES.CSV_DETAIL.replace(':csvId', item.id),
      title: item.title
    })
  })
}

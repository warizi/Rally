import { FileText } from 'lucide-react'
import { ROUTES } from '@shared/constants/tab-url'
import { isOwnWrite, NOTE_EXTERNAL_CHANGED_EVENT } from '@entities/note'
import { useFileWatcher } from '../lib/use-file-watcher'

/** MainLayout에서 호출 — note:changed push 이벤트 구독 + React Query invalidation */
export function useNoteWatcher(): void {
  useFileWatcher({
    onChanged: window.api.note.onChanged,
    queryKeyPrefix: 'note',
    icon: FileText,
    externalChangedEvent: NOTE_EXTERNAL_CHANGED_EVENT,
    idField: 'noteId',
    isOwnWrite,
    buildTabOptions: (item) => ({
      type: 'note',
      pathname: ROUTES.NOTE_DETAIL.replace(':noteId', item.id),
      title: item.title
    })
  })
}

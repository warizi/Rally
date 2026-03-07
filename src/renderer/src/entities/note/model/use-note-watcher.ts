import { FileText } from 'lucide-react'
import { useFileWatcher } from '@shared/hooks/use-file-watcher'
import { isOwnWrite } from './own-write-tracker'

/** 외부 파일 변경 시 발생하는 커스텀 이벤트 이름 */
export const NOTE_EXTERNAL_CHANGED_EVENT = 'note:external-changed'

/** MainLayout에서 호출 — note:changed push 이벤트 구독 + React Query invalidation */
export function useNoteWatcher(): void {
  useFileWatcher({
    onChanged: window.api.note.onChanged,
    queryKeyPrefix: 'note',
    icon: FileText,
    externalChangedEvent: NOTE_EXTERNAL_CHANGED_EVENT,
    idField: 'noteId',
    isOwnWrite
  })
}

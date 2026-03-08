import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import { useFileWatcher } from '@shared/hooks/use-file-watcher'
import { isOwnWrite } from './own-write-tracker'

/** 외부 파일 변경 시 발생하는 커스텀 이벤트 이름 */
export const PDF_EXTERNAL_CHANGED_EVENT = 'pdf:external-changed'

/** MainLayout에서 호출 — pdf:changed push 이벤트 구독 + React Query invalidation */
export function usePdfWatcher(): void {
  useFileWatcher({
    onChanged: window.api.pdf.onChanged,
    queryKeyPrefix: 'pdf',
    icon: PdfIcon,
    externalChangedEvent: PDF_EXTERNAL_CHANGED_EVENT,
    idField: 'pdfId',
    isOwnWrite
  })
}

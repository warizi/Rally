import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import { ROUTES } from '@shared/constants/tab-url'
import { isOwnWrite, PDF_EXTERNAL_CHANGED_EVENT } from '@entities/pdf-file'
import { useFileWatcher } from '../lib/use-file-watcher'

/** MainLayout에서 호출 — pdf:changed push 이벤트 구독 + React Query invalidation */
export function usePdfWatcher(): void {
  useFileWatcher({
    onChanged: window.api.pdf.onChanged,
    queryKeyPrefix: 'pdf',
    icon: PdfIcon,
    externalChangedEvent: PDF_EXTERNAL_CHANGED_EVENT,
    idField: 'pdfId',
    isOwnWrite,
    buildTabOptions: (item) => ({
      type: 'pdf',
      pathname: ROUTES.PDF_DETAIL.replace(':pdfId', item.id),
      title: item.title
    })
  })
}

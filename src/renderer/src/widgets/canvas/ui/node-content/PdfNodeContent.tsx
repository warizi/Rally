import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useReadPdfContent } from '@entities/pdf-file'
import { PdfViewer } from '@features/pdf/view-pdf'
import type { NodeContentProps } from '../../model/node-content-registry'

export function PdfNodeContent({ refId }: NodeContentProps): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const { data, isLoading } = useReadPdfContent(workspaceId, refId ?? '')

  if (isLoading) {
    return <div className="p-3 flex-1 text-xs text-muted-foreground">불러오는 중...</div>
  }

  if (!data?.data) {
    return <div className="p-3 flex-1 text-xs text-muted-foreground">PDF를 불러올 수 없습니다.</div>
  }

  return (
    <div className="flex-1 overflow-hidden min-h-0">
      <PdfViewer pdfId={refId ?? ''} pdfData={data.data} />
    </div>
  )
}

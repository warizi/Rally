import { JSX, useEffect } from 'react'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useReadPdfContent } from '@entities/pdf-file'
import { FolderX } from 'lucide-react'
import { useTabStore } from '@/features/tap-system/manage-tab-system'
import { PdfHeader } from '@/features/pdf/view-pdf'
import { PdfViewer } from '@/widgets/pdf-viewer'

export function PdfPage({
  tabId,
  params
}: {
  tabId?: string
  params?: Record<string, string>
}): JSX.Element {
  const pdfId = params?.pdfId ?? ''
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const setTabError = useTabStore((s) => s.setTabError)

  const { data, isLoading, isError } = useReadPdfContent(workspaceId, pdfId)

  useEffect(() => {
    if (tabId && isError) {
      setTabError(tabId, true)
    }
  }, [isError, tabId, setTabError])

  if (!pdfId || !workspaceId) {
    return (
      <TabContainer header={null}>
        <div className="text-sm text-muted-foreground p-4">PDF 정보가 없습니다.</div>
      </TabContainer>
    )
  }

  if (isLoading) {
    return (
      <TabContainer header={<TabHeader isLoading />}>
        <div />
      </TabContainer>
    )
  }

  if (isError) {
    return (
      <TabContainer header={null}>
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground mt-20">
          <FolderX className="size-12" />
          <p className="text-sm">PDF 불러오기를 실패하였습니다.</p>
          <p className="text-xs">이 탭을 닫아주세요.</p>
        </div>
      </TabContainer>
    )
  }

  return (
    <TabContainer
      scrollable={false}
      maxWidth="full"
      header={<PdfHeader workspaceId={workspaceId} pdfId={pdfId} tabId={tabId} />}
    >
      <PdfViewer pdfId={pdfId} pdfData={data?.data ?? new ArrayBuffer(0)} />
    </TabContainer>
  )
}

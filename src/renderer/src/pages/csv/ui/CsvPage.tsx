import { JSX, useEffect } from 'react'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useReadCsvContent } from '@entities/csv-file'
import { FolderX } from 'lucide-react'
import { useTabStore } from '@/features/tap-system/manage-tab-system'
import { CsvHeader } from '@/features/csv/edit-csv'
import { CsvViewer } from '@/widgets/csv-viewer'

export function CsvPage({
  tabId,
  params
}: {
  tabId?: string
  params?: Record<string, string>
}): JSX.Element {
  const csvId = params?.csvId ?? ''
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const setTabError = useTabStore((s) => s.setTabError)

  const { data, isLoading, isError } = useReadCsvContent(workspaceId, csvId)

  useEffect(() => {
    if (tabId && isError) {
      setTabError(tabId, true)
    }
  }, [isError, tabId, setTabError])

  if (!csvId || !workspaceId) {
    return (
      <TabContainer header={null}>
        <div className="text-sm text-muted-foreground p-4">테이블 정보가 없습니다.</div>
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
          <p className="text-sm">테이블 불러오기를 실패하였습니다.</p>
          <p className="text-xs">이 탭을 닫아주세요.</p>
        </div>
      </TabContainer>
    )
  }

  return (
    <TabContainer
      scrollable={false}
      maxWidth="full"
      header={
        <CsvHeader
          workspaceId={workspaceId}
          csvId={csvId}
          tabId={tabId}
          encoding={data?.encoding ?? 'UTF-8'}
        />
      }
    >
      <CsvViewer
        workspaceId={workspaceId}
        csvId={csvId}
        initialContent={data?.content ?? ''}
        initialColumnWidths={data?.columnWidths ?? null}
      />
    </TabContainer>
  )
}

import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useReadCsvContent } from '@entities/csv-file'
import { CsvViewer } from '@features/csv/edit-csv'
import type { NodeContentProps } from '../../model/node-content-registry'

export function CsvNodeContent({ refId }: NodeContentProps): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const { data, isLoading } = useReadCsvContent(workspaceId, refId ?? '')

  if (isLoading) {
    return <div className="p-3 flex-1 text-xs text-muted-foreground">불러오는 중...</div>
  }

  return (
    <div className="flex-1 overflow-hidden min-h-0">
      <CsvViewer
        workspaceId={workspaceId}
        csvId={refId ?? ''}
        initialContent={data?.content ?? ''}
        initialColumnWidths={data?.columnWidths ?? null}
      />
    </div>
  )
}

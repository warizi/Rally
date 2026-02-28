import { JSX } from 'react'
import TabHeader from '@shared/ui/tab-header'
import { useRenameCsvFile, useUpdateCsvMeta, useCsvFilesByWorkspace } from '@entities/csv-file'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { Sheet } from 'lucide-react'

interface CsvHeaderProps {
  workspaceId: string
  csvId: string
  tabId?: string
  encoding?: string
}

export function CsvHeader({ workspaceId, csvId, tabId, encoding }: CsvHeaderProps): JSX.Element {
  const { data: csvFiles } = useCsvFilesByWorkspace(workspaceId)
  const csv = csvFiles?.find((c) => c.id === csvId)

  const { mutate: renameCsv } = useRenameCsvFile()
  const { mutate: updateMeta } = useUpdateCsvMeta()
  const setTabTitle = useTabStore((s) => s.setTabTitle)

  return (
    <TabHeader
      editable
      icon={Sheet}
      iconColor="#10b981"
      title={csv?.title ?? ''}
      description={csv?.description ?? ''}
      buttons={
        encoding ? (
          <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
            {encoding}
          </span>
        ) : undefined
      }
      onTitleChange={(title) => {
        renameCsv({ workspaceId, csvId, newName: title })
        if (tabId) setTabTitle(tabId, title)
      }}
      onDescriptionChange={(desc) => {
        updateMeta({ workspaceId, csvId, data: { description: desc } })
      }}
    />
  )
}

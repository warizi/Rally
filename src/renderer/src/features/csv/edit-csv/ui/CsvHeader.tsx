import { JSX } from 'react'
import TabHeader from '@shared/ui/tab-header'
import {
  useRenameCsvFile,
  useUpdateCsvMeta,
  useCsvFilesByWorkspace,
  useReadCsvContent,
  useWriteCsvContent
} from '@entities/csv-file'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { Sheet } from 'lucide-react'
import { LinkedEntityPopoverButton } from '@features/entity-link/manage-link'
import { TagList } from '@features/tag/manage-tag'
import { TemplateButton } from '@features/template/manage-template'

interface CsvHeaderProps {
  workspaceId: string
  csvId: string
  tabId?: string
  encoding?: string
}

interface CsvTemplatePayload {
  content: string
  columnWidths: string | null
}

/** 헤더만 있거나 모든 data row의 cell이 비어있으면 empty로 판정 */
function isCsvEffectivelyEmpty(content: string): boolean {
  if (!content || content.trim() === '') return true
  const lines = content.split(/\r?\n/).filter((l) => l !== '')
  if (lines.length <= 1) return true
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',')
    if (cells.some((c) => c.trim() !== '')) return false
  }
  return true
}

export function CsvHeader({ workspaceId, csvId, tabId, encoding }: CsvHeaderProps): JSX.Element {
  const { data: csvFiles } = useCsvFilesByWorkspace(workspaceId)
  const csv = csvFiles?.find((c) => c.id === csvId)
  const { data: csvContent } = useReadCsvContent(workspaceId, csvId)

  const { mutate: renameCsv } = useRenameCsvFile()
  const { mutate: updateMeta } = useUpdateCsvMeta()
  const { mutate: writeContent } = useWriteCsvContent()
  const setTabTitle = useTabStore((s) => s.setTabTitle)

  const currentContent = csvContent?.content ?? ''
  const currentColumnWidths = csvContent?.columnWidths ?? null
  const isEmpty = isCsvEffectivelyEmpty(currentContent)

  const getJsonData = (): string | null => {
    if (isEmpty) return null
    const payload: CsvTemplatePayload = {
      content: currentContent,
      columnWidths: currentColumnWidths
    }
    return JSON.stringify(payload)
  }

  const handleApply = (jsonData: string): void => {
    let payload: CsvTemplatePayload
    try {
      payload = JSON.parse(jsonData) as CsvTemplatePayload
    } catch {
      return
    }
    writeContent({ workspaceId, csvId, content: payload.content })
    if (payload.columnWidths !== undefined) {
      updateMeta({
        workspaceId,
        csvId,
        data: { columnWidths: payload.columnWidths ?? '' }
      })
    }
  }

  return (
    <TabHeader
      editable
      icon={Sheet}
      iconColor="#10b981"
      title={csv?.title ?? ''}
      description={csv?.description ?? ''}
      buttons={
        <div className="flex items-center gap-1">
          {encoding && (
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
              {encoding}
            </span>
          )}
          <TemplateButton
            workspaceId={workspaceId}
            type="csv"
            getJsonData={getJsonData}
            hasContent={!isEmpty}
            onApply={handleApply}
          />
          <LinkedEntityPopoverButton entityType="csv" entityId={csvId} workspaceId={workspaceId} />
        </div>
      }
      footer={<TagList workspaceId={workspaceId} itemType="csv" itemId={csvId} />}
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

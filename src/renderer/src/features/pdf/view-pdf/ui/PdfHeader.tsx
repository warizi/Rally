import { JSX } from 'react'
import TabHeader from '@shared/ui/tab-header'
import { useRenamePdfFile, useUpdatePdfMeta, usePdfFilesByWorkspace } from '@entities/pdf-file'
import { useTabStore } from '@/entities/tab-system'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import { LinkedEntityPopoverButton } from '@features/entity-link/manage-link'
import { TagList } from '@features/tag/manage-tag'
import { AuthorBadgePair } from '@shared/ui/author-badge'

interface PdfHeaderProps {
  workspaceId: string
  pdfId: string
  tabId?: string
}

export function PdfHeader({ workspaceId, pdfId, tabId }: PdfHeaderProps): JSX.Element {
  const { data: pdfFiles } = usePdfFilesByWorkspace(workspaceId)
  const pdf = pdfFiles?.find((p) => p.id === pdfId)

  const { mutate: renamePdf } = useRenamePdfFile()
  const { mutate: updateMeta } = useUpdatePdfMeta()
  const setTabTitle = useTabStore((s) => s.setTabTitle)

  return (
    <TabHeader
      editable
      icon={PdfIcon}
      iconColor="#ef4444"
      title={pdf?.title ?? ''}
      description={pdf?.description ?? ''}
      buttons={
        <LinkedEntityPopoverButton entityType="pdf" entityId={pdfId} workspaceId={workspaceId} />
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <TagList workspaceId={workspaceId} itemType="pdf" itemId={pdfId} />
          {pdf && (
            <AuthorBadgePair
              createdBy={pdf.createdBy}
              createdById={pdf.createdById}
              createdAt={pdf.createdAt}
              updatedBy={pdf.updatedBy}
              updatedById={pdf.updatedById}
              updatedAt={pdf.updatedAt}
              size="sm"
            />
          )}
        </div>
      }
      onTitleChange={(title) => {
        renamePdf({ workspaceId, pdfId, newName: title })
        if (tabId) setTabTitle(tabId, title)
      }}
      onDescriptionChange={(desc) => {
        updateMeta({ workspaceId, pdfId, data: { description: desc } })
      }}
    />
  )
}

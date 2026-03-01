import { JSX } from 'react'
import TabHeader from '@shared/ui/tab-header'
import { useRenamePdfFile, useUpdatePdfMeta, usePdfFilesByWorkspace } from '@entities/pdf-file'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { FileText } from 'lucide-react'

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
      icon={FileText}
      iconColor="#ef4444"
      title={pdf?.title ?? ''}
      description={pdf?.description ?? ''}
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

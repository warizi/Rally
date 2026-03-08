import { useMemo } from 'react'
import { FileSpreadsheet, FileText, FolderOpen, ImageIcon } from 'lucide-react'
import { useCsvFilesByWorkspace } from '@entities/csv-file'
import type { CsvFileNode } from '@entities/csv-file'
import { usePdfFilesByWorkspace } from '@entities/pdf-file'
import type { PdfFileNode } from '@entities/pdf-file'
import { useImageFilesByWorkspace } from '@entities/image-file'
import type { ImageFileNode } from '@entities/image-file'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { ROUTES } from '@shared/constants/tab-url'
import { Button } from '@shared/ui/button'
import { DashboardCard } from '@shared/ui/dashboard-card'
import { Separator } from '@shared/ui/separator'

interface FileOverviewCardProps {
  workspaceId: string
}

export function FileOverviewCard({ workspaceId }: FileOverviewCardProps): React.JSX.Element {
  const { data: csvFiles = [], isLoading: csvLoading } = useCsvFilesByWorkspace(workspaceId)
  const { data: pdfFiles = [], isLoading: pdfLoading } = usePdfFilesByWorkspace(workspaceId)
  const { data: imageFiles = [], isLoading: imgLoading } = useImageFilesByWorkspace(workspaceId)

  const isLoading = csvLoading || pdfLoading || imgLoading
  const openTab = useTabStore((s) => s.openTab)

  const recentFiles = useMemo(
    () => ({
      csv: [...csvFiles].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 3),
      pdf: [...pdfFiles].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 3),
      image: [...imageFiles]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 3)
    }),
    [csvFiles, pdfFiles, imageFiles]
  )

  const openCsv = (f: CsvFileNode): void => {
    openTab({ type: 'csv', pathname: ROUTES.CSV_DETAIL.replace(':csvId', f.id), title: f.title })
  }
  const openPdf = (f: PdfFileNode): void => {
    openTab({ type: 'pdf', pathname: ROUTES.PDF_DETAIL.replace(':pdfId', f.id), title: f.title })
  }
  const openImage = (f: ImageFileNode): void => {
    openTab({
      type: 'image',
      pathname: ROUTES.IMAGE_DETAIL.replace(':imageId', f.id),
      title: f.title
    })
  }

  const handleOpenFolder = (): void => {
    openTab({ type: 'folder', pathname: ROUTES.FOLDER, title: '파일 탐색기' })
  }

  const totalFiles = csvFiles.length + pdfFiles.length + imageFiles.length

  return (
    <DashboardCard
      title="파일 현황"
      icon={FolderOpen}
      isLoading={isLoading}
      action={
        <Button variant="ghost" size="sm" className="text-xs" onClick={handleOpenFolder}>
          탐색기
        </Button>
      }
    >
      {totalFiles === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">파일이 없습니다</p>
          <Button variant="outline" size="sm" onClick={handleOpenFolder}>
            파일 탐색기 열기
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <FileTypeRow
            icon={FileSpreadsheet}
            label="CSV"
            count={csvFiles.length}
            files={recentFiles.csv}
            onFileClick={openCsv}
          />
          <Separator />
          <FileTypeRow
            icon={FileText}
            label="PDF"
            count={pdfFiles.length}
            files={recentFiles.pdf}
            onFileClick={openPdf}
          />
          <Separator />
          <FileTypeRow
            icon={ImageIcon}
            label="이미지"
            count={imageFiles.length}
            files={recentFiles.image}
            onFileClick={openImage}
          />
        </div>
      )}
    </DashboardCard>
  )
}

function FileTypeRow<T extends { id: string; title: string }>({
  icon: Icon,
  label,
  count,
  files,
  onFileClick
}: {
  icon: React.ElementType
  label: string
  count: number
  files: T[]
  onFileClick: (f: T) => void
}): React.JSX.Element {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">{label}</span>
        <span className="ml-auto tabular-nums font-medium">{count}</span>
      </div>
      {files.map((file) => (
        <button
          key={file.id}
          className="flex w-full items-center rounded-md px-2 py-0.5 text-left text-xs transition-colors hover:bg-accent"
          onClick={() => onFileClick(file)}
        >
          <span className="truncate text-muted-foreground">{file.title}</span>
        </button>
      ))}
    </div>
  )
}

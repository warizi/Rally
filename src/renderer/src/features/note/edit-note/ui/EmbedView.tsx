/**
 * 임베드 시각화 — 4 도메인 분기.
 *
 * - note: id → 제목 fetch (workspace list), 아이콘 + 제목 link 형식 (클릭 무동작)
 * - csv: id → content fetch, 단순 표 렌더 (read-only, 툴바 없이)
 * - pdf: id → content fetch, PdfViewer hideToolbar 로 렌더
 *
 * fallback: id 못 찾으면 "[삭제된 X]" 표시.
 */
import { FileText, Sheet, FileX } from 'lucide-react'
import { useNotesByWorkspace } from '@entities/note'
import { useCsvFilesByWorkspace, useReadCsvContent } from '@entities/csv-file'
import { usePdfFilesByWorkspace, useReadPdfContent } from '@entities/pdf-file'
import { useCurrentWorkspaceStore } from '@/shared/store/current-workspace'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import { PdfViewer } from '@/features/pdf/view-pdf/ui/PdfViewer'
import type { EmbedDomain } from '../model/note-embed-schema'

interface Props {
  domain: EmbedDomain
  entityId: string
  height: number
}

export function EmbedView({ domain, entityId, height }: Props): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  if (domain === 'note') return <NoteEmbedView workspaceId={workspaceId} entityId={entityId} />
  if (domain === 'csv')
    return <CsvEmbedView workspaceId={workspaceId} entityId={entityId} height={height} />
  if (domain === 'pdf')
    return <PdfEmbedView workspaceId={workspaceId} entityId={entityId} height={height} />
  return <FallbackEmbed label="알 수 없는 임베드" />
}

function FallbackEmbed({ label }: { label: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground italic">
      <FileX className="size-3.5" />
      {label}
    </span>
  )
}

// ─── note ──────────────────────────────────────────────

function NoteEmbedView({
  workspaceId,
  entityId
}: {
  workspaceId: string
  entityId: string
}): React.JSX.Element {
  const { data: notes = [] } = useNotesByWorkspace(workspaceId)
  const note = notes.find((n) => n.id === entityId)
  if (!note) return <FallbackEmbed label="[삭제된 노트]" />
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-sm bg-accent text-accent-foreground cursor-default select-none"
      title={note.title}
      contentEditable={false}
    >
      <FileText className="size-3.5 shrink-0" />
      <span className="truncate">{note.title}</span>
    </span>
  )
}

// ─── csv ───────────────────────────────────────────────

/** 단순 csv 파서 — quote/escape 무시한 split 기반. 임베드 표시용. */
function parseCsv(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = lines[0].split(',')
  const rows = lines.slice(1).map((l) => l.split(','))
  return { headers, rows }
}

function CsvEmbedView({
  workspaceId,
  entityId,
  height
}: {
  workspaceId: string
  entityId: string
  height: number
}): React.JSX.Element {
  const { data: csvs = [] } = useCsvFilesByWorkspace(workspaceId)
  const csv = csvs.find((c) => c.id === entityId)
  const { data: content } = useReadCsvContent(workspaceId, entityId)
  if (!csv) return <FallbackEmbed label="[삭제된 CSV]" />
  const parsed = parseCsv(content?.content ?? '')
  return (
    <span
      className="block my-2 border rounded overflow-hidden bg-card"
      style={{ height: height > 0 ? height : 400 }}
      contentEditable={false}
    >
      <span className="flex items-center gap-1.5 px-3 py-1.5 border-b text-xs font-medium bg-muted/40">
        <Sheet className="size-3.5" />
        {csv.title}
      </span>
      <span className="block overflow-auto" style={{ height: `calc(100% - 32px)` }}>
        {parsed.headers.length === 0 ? (
          <span className="block p-4 text-xs text-muted-foreground">빈 CSV</span>
        ) : (
          <table className="text-xs w-full border-collapse">
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                {parsed.headers.map((h, i) => (
                  <th key={i} className="text-left px-2 py-1 border-b font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-muted/20">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1 border-b whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </span>
    </span>
  )
}

// ─── pdf ───────────────────────────────────────────────

function PdfEmbedView({
  workspaceId,
  entityId,
  height
}: {
  workspaceId: string
  entityId: string
  height: number
}): React.JSX.Element {
  const { data: pdfs = [] } = usePdfFilesByWorkspace(workspaceId)
  const pdf = pdfs.find((p) => p.id === entityId)
  const { data: content } = useReadPdfContent(workspaceId, entityId)
  if (!pdf) return <FallbackEmbed label="[삭제된 PDF]" />
  return (
    <span
      className="block my-2 border rounded overflow-hidden bg-card"
      style={{ height: height > 0 ? height : 600 }}
      contentEditable={false}
    >
      <span className="flex items-center gap-1.5 px-3 py-1.5 border-b text-xs font-medium bg-muted/40">
        <PdfIcon className="size-3.5" />
        {pdf.title}
      </span>
      <span className="block" style={{ height: `calc(100% - 32px)` }}>
        {content?.data ? (
          <PdfViewer pdfId={entityId} pdfData={content.data} hideToolbar />
        ) : (
          <span className="block p-4 text-xs text-muted-foreground">PDF 로딩 중...</span>
        )}
      </span>
    </span>
  )
}

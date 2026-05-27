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
import Papa from 'papaparse'
import { ScrollArea, ScrollBar } from '@shared/ui/scroll-area'
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

/** CSV 파서 — Papa Parse 사용 (use-csv-editor 와 동일).
 * - quote / escape 정상 처리
 * - skipEmptyLines: true (중간 빈 줄 제외) — useCsvEditor 패턴 일치
 * - 부족한 셀은 빈 셀로 패딩 → row height 일관 */
function parseCsv(content: string): { headers: string[]; rows: string[][] } {
  if (!content.trim()) return { headers: [], rows: [] }
  const result = Papa.parse<string[]>(content, {
    header: false,
    skipEmptyLines: true
  })
  const allRows = result.data
  if (allRows.length === 0) return { headers: [], rows: [] }
  const headers = allRows[0]
  const rows = allRows.slice(1).map((row) => {
    const cells = [...row]
    while (cells.length < headers.length) cells.push('')
    return cells
  })
  return { headers, rows }
}

/** columnWidths JSON → 컬럼별 너비. 없거나 파싱 실패 시 빈 객체. */
function parseColumnWidths(json: string | null | undefined): Record<string, number> {
  if (!json) return {}
  try {
    return JSON.parse(json) as Record<string, number>
  } catch {
    return {}
  }
}

const DEFAULT_CSV_COL_WIDTH = 150

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
  const widths = parseColumnWidths(content?.columnWidths)
  const useFixedHeight = height > 0
  const tableEl =
    parsed.headers.length === 0 ? (
      <div className="p-4 text-xs text-muted-foreground">빈 CSV</div>
    ) : (
      <table
        className="text-xs border-collapse"
        style={{ tableLayout: 'fixed', width: 'max-content' }}
      >
        <colgroup>
          {parsed.headers.map((_, i) => (
            <col key={i} style={{ width: widths[`col_${i}`] ?? DEFAULT_CSV_COL_WIDTH }} />
          ))}
        </colgroup>
        <thead className="bg-muted/30 sticky top-0">
          <tr>
            {parsed.headers.map((h, i) => (
              <th key={i} className="text-left px-2 py-1 border-b font-medium truncate">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsed.rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-muted/20">
              {row.map((cell, ci) => (
                <td key={ci} className="px-2 py-1 border-b truncate">
                  {cell || ' '}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )

  return (
    <div
      className="flex flex-col my-2 border rounded overflow-hidden bg-card"
      style={useFixedHeight ? { height } : undefined}
      contentEditable={false}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 border-b text-sm font-medium bg-muted/40 shrink-0">
        <Sheet className="size-3.5" />
        {csv.title}
      </div>
      {useFixedHeight ? (
        // h 메타 있으면 fixed height + ScrollArea (가로/세로)
        <ScrollArea className="flex-1 min-h-0">
          {tableEl}
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        // h 메타 없으면 콘텐츠 height + max 500 + ScrollArea (가로/세로).
        // viewportClassName 으로 Viewport 에 max-h 적용 → 콘텐츠 작으면
        // 콘텐츠 크기, 크면 500 까지 잘리며 내부 스크롤.
        <ScrollArea viewportClassName="max-h-[500px]">
          {tableEl}
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
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
    <div
      className="flex flex-col my-2 border rounded overflow-hidden bg-card"
      style={{ height: height > 0 ? height : 600 }}
      contentEditable={false}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 border-b text-sm font-medium bg-muted/40 shrink-0">
        <PdfIcon className="size-3.5" />
        {pdf.title}
      </div>
      <div className="flex-1 min-h-0">
        {content?.data ? (
          <PdfViewer pdfId={entityId} pdfData={content.data} hideToolbar />
        ) : (
          <div className="p-4 text-xs text-muted-foreground">PDF 로딩 중...</div>
        )}
      </div>
    </div>
  )
}

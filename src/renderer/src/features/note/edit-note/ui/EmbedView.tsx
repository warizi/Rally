/**
 * 임베드 시각화 — 5 도메인 분기.
 *
 * - note: id → 제목 fetch (workspace list), 아이콘 + 제목 link 형식 (클릭 무동작)
 * - csv: id → content fetch, 단순 표 렌더 (read-only, 툴바 없이)
 * - pdf: id → content fetch, PdfViewer hideToolbar 로 렌더
 * - image: id → workspace image-file content fetch, blob URL 로 표시
 * - canvas: id → 제목 link 형식 (노트 임베드와 동일, 클릭 시 캔버스 탭 열기)
 *
 * fallback: id 못 찾으면 "[삭제된 X]" 표시.
 */
import { useEffect, useState } from 'react'
import { FileText, Sheet, FileX, Image as ImageIcon, Network } from 'lucide-react'
import Papa from 'papaparse'
import { ScrollArea, ScrollBar } from '@shared/ui/scroll-area'
import { useNotesByWorkspace } from '@entities/note'
import { useCsvFilesByWorkspace, useReadCsvContent } from '@entities/csv-file'
import { usePdfFilesByWorkspace, useReadPdfContent } from '@entities/pdf-file'
import { useImageFilesByWorkspace, useReadImageContent } from '@entities/image-file'
import { useCanvasesByWorkspace } from '@entities/canvas'
import { useCurrentWorkspaceStore } from '@/shared/store/current-workspace'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import { PdfViewer } from '@entities/pdf-file'
import { useTabStore } from '@/entities/tab-system'
import type { EmbedDomain } from '../model/note-embed-schema'

/** entity → 탭으로 열기. note/csv/pdf/image 는 `/folder/{domain}/{id}`, canvas 는 `/canvas/{id}`. */
function openEntityTab(domain: EmbedDomain, id: string, title: string): void {
  if (domain === 'canvas') {
    useTabStore.getState().openTab({ type: 'canvas-detail', pathname: `/canvas/${id}`, title })
    return
  }
  const pathname =
    domain === 'note'
      ? `/folder/note/${id}`
      : domain === 'csv'
        ? `/folder/csv/${id}`
        : domain === 'pdf'
          ? `/folder/pdf/${id}`
          : `/folder/image/${id}`
  useTabStore.getState().openTab({ type: domain, pathname, title })
}

interface Props {
  domain: EmbedDomain
  entityId: string
  height: number
  onHeightChange: (h: number) => void
}

export function EmbedView({ domain, entityId, height, onHeightChange }: Props): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  if (domain === 'note') return <NoteEmbedView workspaceId={workspaceId} entityId={entityId} />
  if (domain === 'csv')
    return (
      <CsvEmbedView
        workspaceId={workspaceId}
        entityId={entityId}
        height={height}
        onHeightChange={onHeightChange}
      />
    )
  if (domain === 'pdf')
    return (
      <PdfEmbedView
        workspaceId={workspaceId}
        entityId={entityId}
        height={height}
        onHeightChange={onHeightChange}
      />
    )
  if (domain === 'image')
    return (
      <ImageEmbedView
        workspaceId={workspaceId}
        entityId={entityId}
        height={height}
        onHeightChange={onHeightChange}
      />
    )
  if (domain === 'canvas') return <CanvasEmbedView workspaceId={workspaceId} entityId={entityId} />
  return <FallbackEmbed label="알 수 없는 임베드" />
}

/** 하단 resize handle — mousedown + drag 로 height 갱신.
 *
 * 시작 height 는 wrapper 의 실제 렌더링 높이를 측정해서 사용 — currentHeight=0
 * (콘텐츠 크기 모드) 일 때 fallback default 로 jump 하던 문제 방지. */
function ResizeHandle({
  onHeightChange
}: {
  onHeightChange: (h: number) => void
}): React.JSX.Element {
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget
    // wrapper (handle 의 부모) 의 실제 height 측정 — h 메타 없이 콘텐츠 fit
    // 상태에서도 정확한 시작점.
    const wrapper = target.parentElement
    const startH = wrapper ? Math.round(wrapper.getBoundingClientRect().height) : 200
    const startY = e.clientY
    target.setPointerCapture(e.pointerId)

    function onMove(ev: PointerEvent): void {
      const dy = ev.clientY - startY
      const next = Math.max(120, startH + dy)
      onHeightChange(next)
    }
    function onUp(ev: PointerEvent): void {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.releasePointerCapture(ev.pointerId)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      className="h-1.5 cursor-ns-resize bg-muted/40 hover:bg-primary/50 transition-colors shrink-0"
      contentEditable={false}
    />
  )
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
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-sm bg-accent text-accent-foreground hover:bg-accent/80 cursor-pointer select-none"
      title={note.title}
      contentEditable={false}
      onClick={() => openEntityTab('note', note.id, note.title)}
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
  height,
  onHeightChange
}: {
  workspaceId: string
  entityId: string
  height: number
  onHeightChange: (h: number) => void
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
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b text-sm font-medium bg-muted/40 shrink-0 cursor-pointer hover:bg-muted/60"
        onClick={() => openEntityTab('csv', csv.id, csv.title)}
      >
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
        <ScrollArea viewportClassName="max-h-[500px]">
          {tableEl}
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
      <ResizeHandle onHeightChange={onHeightChange} />
    </div>
  )
}

// ─── pdf ───────────────────────────────────────────────

function PdfEmbedView({
  workspaceId,
  entityId,
  height,
  onHeightChange
}: {
  workspaceId: string
  entityId: string
  height: number
  onHeightChange: (h: number) => void
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
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b text-sm font-medium bg-muted/40 shrink-0 cursor-pointer hover:bg-muted/60"
        onClick={() => openEntityTab('pdf', pdf.id, pdf.title)}
      >
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
      <ResizeHandle onHeightChange={onHeightChange} />
    </div>
  )
}

// ─── image ─────────────────────────────────────────────

function ImageEmbedView({
  workspaceId,
  entityId,
  height,
  onHeightChange
}: {
  workspaceId: string
  entityId: string
  height: number
  onHeightChange: (h: number) => void
}): React.JSX.Element {
  const { data: images = [] } = useImageFilesByWorkspace(workspaceId)
  const image = images.find((i) => i.id === entityId)
  const { data: content } = useReadImageContent(workspaceId, entityId)
  // ArrayBuffer → blob URL. URL.createObjectURL 은 side effect → useMemo 가
  // 아닌 useEffect + state 로 처리 (ImageViewer 와 동일 패턴). Strict Mode
  // 에서도 cleanup 매칭 정확.
  const [blobUrl, setBlobUrl] = useState<string>('')
  // blob URL 라이프사이클은 외부 시스템(URL.createObjectURL) 동기화 — render로 derive 불가.
  // React 권장 'effect for external systems' 케이스이므로 set-state-in-effect 룰을 의도적으로 우회.
  useEffect(() => {
    if (!content?.data || content.data.byteLength === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBlobUrl('')
      return
    }
    const url = URL.createObjectURL(new Blob([content.data]))

    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [content?.data])
  if (!image) return <FallbackEmbed label="[삭제된 이미지]" />
  const useFixedHeight = height > 0
  return (
    <div
      className="flex flex-col my-2 border rounded overflow-hidden bg-card"
      style={useFixedHeight ? { height } : undefined}
      contentEditable={false}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b text-sm font-medium bg-muted/40 shrink-0 cursor-pointer hover:bg-muted/60"
        onClick={() => openEntityTab('image', image.id, image.title)}
      >
        <ImageIcon className="size-3.5" />
        {image.title}
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center bg-muted/10">
        {blobUrl ? (
          <img
            src={blobUrl}
            alt=""
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="p-4 text-xs text-muted-foreground">이미지 로딩 중...</div>
        )}
      </div>
      <ResizeHandle onHeightChange={onHeightChange} />
    </div>
  )
}

// ─── canvas ────────────────────────────────────────────

/** 노트 임베드와 동일한 제목 link 형식 — 아이콘 + 제목 inline, 클릭 시 캔버스 탭 열기. */
function CanvasEmbedView({
  workspaceId,
  entityId
}: {
  workspaceId: string
  entityId: string
}): React.JSX.Element {
  const { data: canvases = [] } = useCanvasesByWorkspace(workspaceId)
  const canvas = canvases.find((c) => c.id === entityId)
  if (!canvas) return <FallbackEmbed label="[삭제된 캔버스]" />
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-sm bg-accent text-accent-foreground hover:bg-accent/80 cursor-pointer select-none"
      title={canvas.title}
      contentEditable={false}
      onClick={() => openEntityTab('canvas', canvas.id, canvas.title)}
    >
      <Network className="size-3.5 shrink-0" />
      <span className="truncate">{canvas.title}</span>
    </span>
  )
}

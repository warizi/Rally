/**
 * 임베드 시각화 — 4 도메인 분기.
 *
 * 이번 단계 구현:
 * - note: id → 제목 fetch (workspace list 에서 find), 아이콘 + 제목 link 형식 (클릭 무동작)
 * - csv: id → 제목 fetch, placeholder 박스 (실제 표 컴포넌트 wiring 은 후속)
 * - pdf: id → 제목 fetch, placeholder 박스 (실제 PDF wrapper wiring 은 후속)
 *
 * 모든 도메인 공통 fallback: id 못 찾으면 "[삭제된 X]" 표시.
 */
import { FileText, Sheet, FileX } from 'lucide-react'
import { useNotesByWorkspace } from '@entities/note'
import { useCsvFilesByWorkspace } from '@entities/csv-file'
import { usePdfFilesByWorkspace } from '@entities/pdf-file'
import { useCurrentWorkspaceStore } from '@/shared/store/current-workspace'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'
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

// ─── csv (placeholder) ─────────────────────────────────

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
  if (!csv) return <FallbackEmbed label="[삭제된 CSV]" />
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
      <span className="block p-4 text-xs text-muted-foreground">
        CSV 임베드 — 실제 표 렌더링은 후속 단계
      </span>
    </span>
  )
}

// ─── pdf (placeholder) ─────────────────────────────────

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
      <span className="block p-4 text-xs text-muted-foreground">
        PDF 임베드 — 실제 렌더링은 후속 단계
      </span>
    </span>
  )
}

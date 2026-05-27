/**
 * @ trigger picker UI — 4 도메인 (note/csv/pdf/image) 통합 검색.
 *
 * 동작 원칙:
 * - store.open 일 때만 render (absolute, store.position 기준)
 * - 검색어는 store.query 구독 (plugin 이 @ 다음 텍스트 갱신)
 * - 키보드: ↑↓ 항목 이동 / Enter 선택 / Esc 닫기 — plugin 이 store close, React 가
 *   selection 처리.
 * - 선택 시: ProseMirror view 를 통해 store.range 텍스트 (`@검색어`) 를 embed 노드로
 *   대체. 이미지는 마크다운 `![h=NNN](.images/...)` 가 아닌 entity id 기반 별도
 *   처리 (image entity 에 어떻게 임베드할지는 후속) — 우선 이번 단계는 image 도
 *   같은 embed 노드로 처리 (단, NodeView 단계에서 분기).
 */
import { useEffect, useMemo, useState, useRef } from 'react'
import { useInstance } from '@milkdown/react'
import { editorViewCtx } from '@milkdown/kit/core'
import { Check, FileText, Sheet, Image as ImageIcon, type LucideIcon } from 'lucide-react'
import { useEmbedPickerStore } from '../model/embed-picker-store'
import { useNotesByWorkspace } from '@entities/note'
import { useCsvFilesByWorkspace } from '@entities/csv-file'
import { usePdfFilesByWorkspace } from '@entities/pdf-file'
import { useImageFilesByWorkspace } from '@entities/image-file'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import { RALLY_EMBED_NODE_NAME, type EmbedDomain } from '../model/note-embed-schema'

interface PickerItem {
  domain: EmbedDomain | 'image'
  id: string
  title: string
}

const ICONS: Record<PickerItem['domain'], LucideIcon | typeof PdfIcon> = {
  note: FileText,
  csv: Sheet,
  pdf: PdfIcon,
  image: ImageIcon
}

interface Props {
  workspaceId: string
}

export function EmbedPicker({ workspaceId }: Props): React.JSX.Element | null {
  const open = useEmbedPickerStore((s) => s.open)
  const query = useEmbedPickerStore((s) => s.query)
  const position = useEmbedPickerStore((s) => s.position)
  const range = useEmbedPickerStore((s) => s.range)
  const closePicker = useEmbedPickerStore((s) => s.closePicker)

  const { data: notes = [] } = useNotesByWorkspace(workspaceId)
  const { data: csvs = [] } = useCsvFilesByWorkspace(workspaceId)
  const { data: pdfs = [] } = usePdfFilesByWorkspace(workspaceId)
  const { data: images = [] } = useImageFilesByWorkspace(workspaceId)

  const allItems = useMemo<PickerItem[]>(
    () => [
      ...notes.map((n) => ({ domain: 'note' as const, id: n.id, title: n.title })),
      ...csvs.map((c) => ({ domain: 'csv' as const, id: c.id, title: c.title })),
      ...pdfs.map((p) => ({ domain: 'pdf' as const, id: p.id, title: p.title })),
      ...images.map((i) => ({ domain: 'image' as const, id: i.id, title: i.title }))
    ],
    [notes, csvs, pdfs, images]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allItems.slice(0, 50)
    return allItems.filter((i) => i.title.toLowerCase().includes(q)).slice(0, 50)
  }, [allItems, query])

  const [focusIndex, setFocusIndex] = useState(0)
  useEffect(() => {
    setFocusIndex(0)
  }, [query, open])

  const [loading, getEditor] = useInstance()
  void loading

  // 키보드 nav: store.open 일 때만 활성
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusIndex((i) => Math.min(filtered.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = filtered[focusIndex]
        if (item) handleSelect(item)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtered, focusIndex])

  function handleSelect(item: PickerItem): void {
    const editor = getEditor()
    if (!editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const schema = view.state.schema
      const embedType = schema.nodes[RALLY_EMBED_NODE_NAME]
      if (!embedType) return
      // image 도메인은 별도 처리 — embed 노드 대신 markdown image 직접 삽입
      if (item.domain === 'image') {
        // image 엔티티의 relativePath 가 .images/... 일 가능성 — 우선 단순 처리:
        // 이미지 임베드는 후속 단계에서 처리. 지금은 일단 노트/csv/pdf 만 embed.
        closePicker()
        return
      }
      const node = embedType.create({
        domain: item.domain,
        entityId: item.id,
        height: item.domain === 'note' ? 0 : item.domain === 'csv' ? 400 : 600
      })
      const tr = view.state.tr
        .replaceRangeWith(range.from, range.to, node)
        .insertText(' ', range.from + 1)
      view.dispatch(tr)
      view.focus()
      closePicker()
    })
  }

  // 외부 클릭 시 닫기
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent): void {
      const el = containerRef.current
      if (!el) return
      if (!el.contains(e.target as Node)) closePicker()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, closePicker])

  if (!open) return null

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-72 max-h-72 overflow-y-auto rounded-md border bg-popover shadow-md p-1"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(e) => {
        // input/editor 포커스 빼앗기지 않게
        e.preventDefault()
      }}
    >
      {filtered.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4">결과 없음</div>
      ) : (
        filtered.map((item, i) => {
          const Icon = ICONS[item.domain]
          const isFocus = i === focusIndex
          return (
            <button
              key={`${item.domain}:${item.id}`}
              type="button"
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setFocusIndex(i)}
              className={
                'w-full flex items-center gap-2 text-xs rounded px-2 py-1.5 text-left cursor-pointer ' +
                (isFocus ? 'bg-accent text-accent-foreground' : 'hover:bg-accent')
              }
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate flex-1">{item.title}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{item.domain}</span>
              {isFocus && <Check className="size-3 text-primary shrink-0" />}
            </button>
          )
        })
      )}
    </div>
  )
}

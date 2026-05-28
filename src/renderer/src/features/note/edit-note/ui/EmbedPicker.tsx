/**
 * @ trigger picker UI — 4 도메인 통합 검색 + 자체 input (IME 호환).
 *
 * 동작:
 * - store.open → popup 표시 + 자동 focus
 * - 사용자 input 으로 query (한글 IME OK — ProseMirror 외부)
 * - ↑↓Enter 키보드 nav, ESC 닫기
 * - 선택 시: ProseMirror dispatch — store.range (`@`) 를 embed 노드로 치환
 * - 취소(닫힘) 시 노트 본문의 `@` 는 그대로 남음 (사용자가 직접 지움)
 */
import { useEffect, useMemo, useRef, useState } from 'react'
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
  domain: EmbedDomain
  id: string
  title: string
}

const ICONS: Record<EmbedDomain, LucideIcon | typeof PdfIcon> = {
  note: FileText,
  csv: Sheet,
  pdf: PdfIcon,
  image: ImageIcon
}

interface Props {
  workspaceId: string
  /** 이 picker 인스턴스를 trigger 한 NoteEditor id — store.editorId 와 일치할 때만 표시. */
  editorId: string
}

export function EmbedPicker({ workspaceId, editorId }: Props): React.JSX.Element | null {
  const openStore = useEmbedPickerStore((s) => s.open)
  const ownerEditorId = useEmbedPickerStore((s) => s.editorId)
  const open = openStore && ownerEditorId === editorId
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

  // 자체 input state (IME 호환 — ProseMirror 외부에서 한글 입력 가능)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // open=false 로 바뀔 때 query reset — effect 안 setState 대신 derived state 패턴.
  const [prevOpenForQuery, setPrevOpenForQuery] = useState(open)
  if (prevOpenForQuery !== open) {
    setPrevOpenForQuery(open)
    if (!open) setQuery('')
  }

  useEffect(() => {
    if (!open) return
    // popup 열리면 input 자동 focus
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().normalize('NFC')
    if (!q) return allItems.slice(0, 50)
    // 공백 분리한 모든 토큰이 title 에 포함되어야 매칭 (any position).
    // macOS 파일명은 자주 NFD (자모 분리) 로 저장됨 — 사용자 입력 (NFC) 과
    // 매칭 안 되는 문제 방지하기 위해 양쪽 normalize.
    const tokens = q.split(/\s+/).filter(Boolean)
    return allItems
      .filter((i) => {
        const lower = i.title.toLowerCase().normalize('NFC')
        return tokens.every((t) => lower.includes(t))
      })
      .slice(0, 50)
  }, [allItems, query])

  // query / open 변경 시 focusIndex reset — derived state 패턴.
  const [focusIndex, setFocusIndex] = useState(0)
  const [prevResetKey, setPrevResetKey] = useState({ query, open })
  if (prevResetKey.query !== query || prevResetKey.open !== open) {
    setPrevResetKey({ query, open })
    setFocusIndex(0)
  }

  const [loading, getEditor] = useInstance()
  void loading

  function handleSelect(item: PickerItem): void {
    const editor = getEditor()
    if (!editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const schema = view.state.schema
      const embedType = schema.nodes[RALLY_EMBED_NODE_NAME]
      if (!embedType) return
      // 기본 height — note: 0 (inline 링크), csv: 0 (콘텐츠 크기), pdf/image: 고정.
      const defaultHeight = item.domain === 'pdf' ? 600 : item.domain === 'image' ? 400 : 0
      const node = embedType.create({
        domain: item.domain,
        entityId: item.id,
        height: defaultHeight
      })
      const tr = view.state.tr
        .replaceRangeWith(range.from, range.to, node)
        .insertText(' ', range.from + 1)
      view.dispatch(tr)
      view.focus()
      closePicker()
    })
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
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
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closePicker()
    }
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
      className="fixed z-50 w-72 rounded-md border bg-popover shadow-md p-1"
      style={{ left: position.x, top: position.y }}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleInputKeyDown}
        placeholder="검색..."
        className="w-full px-2 py-1 mb-1 text-xs bg-transparent border-b outline-none"
      />
      <div className="max-h-60 overflow-y-auto">
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
    </div>
  )
}

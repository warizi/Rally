/**
 * @ trigger picker UI — 5 도메인 통합 검색 + 자체 input (IME 호환).
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
import { Check, FileText, Sheet, Image as ImageIcon, Network, type LucideIcon } from 'lucide-react'
import { useEmbedPickerStore } from '../model/embed-picker-store'
import { useNotesByWorkspace } from '@entities/note'
import { useCsvFilesByWorkspace } from '@entities/csv-file'
import { usePdfFilesByWorkspace } from '@entities/pdf-file'
import { useImageFilesByWorkspace } from '@entities/image-file'
import { useCanvasesByWorkspace } from '@entities/canvas'
import { useEntitySearchMulti, type SearchType } from '@entities/search'
import { useDebouncedValue } from '@shared/hooks/use-debounced-value'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import { ScrollArea } from '@shared/ui/scroll-area'
import { RALLY_EMBED_NODE_NAME, type EmbedDomain } from '../model/note-embed-schema'

// 벡터 검색 지원 SearchType → EmbedDomain (note/csv/canvas만 임베딩 대상)
const SEARCH_TO_DOMAIN: Partial<Record<SearchType, EmbedDomain>> = {
  note: 'note',
  table: 'csv',
  canvas: 'canvas'
}
const VECTOR_SEARCH_TYPES: SearchType[] = ['note', 'table', 'canvas']

interface PickerItem {
  domain: EmbedDomain
  id: string
  title: string
}

const ICONS: Record<EmbedDomain, LucideIcon | typeof PdfIcon> = {
  note: FileText,
  csv: Sheet,
  pdf: PdfIcon,
  image: ImageIcon,
  canvas: Network
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
  const { data: canvases = [] } = useCanvasesByWorkspace(workspaceId)

  const allItems = useMemo<PickerItem[]>(
    () => [
      ...notes.map((n) => ({ domain: 'note' as const, id: n.id, title: n.title })),
      ...csvs.map((c) => ({ domain: 'csv' as const, id: c.id, title: c.title })),
      ...pdfs.map((p) => ({ domain: 'pdf' as const, id: p.id, title: p.title })),
      ...images.map((i) => ({ domain: 'image' as const, id: i.id, title: i.title })),
      ...canvases.map((cv) => ({ domain: 'canvas' as const, id: cv.id, title: cv.title }))
    ],
    [notes, csvs, pdfs, images, canvases]
  )

  // 자체 input state (IME 호환 — ProseMirror 외부에서 한글 입력 가능)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

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

  // 일반(제목 키워드) + 벡터(의미) 검색.
  // - 일반: 클라이언트 다중 토큰 substring (즉시, 5도메인 전체)
  // - 벡터: note/csv/canvas 시맨틱 결과 중 일반에 없는 것 (제목 안 맞아도 의미로 매칭)
  const itemMap = useMemo(() => {
    const m = new Map<string, PickerItem>()
    for (const it of allItems) m.set(`${it.domain}:${it.id}`, it)
    return m
  }, [allItems])

  const trimmedQuery = query.trim()
  const debouncedQuery = useDebouncedValue(trimmedQuery, 200)
  const { data: hits, isFetching: semanticLoading } = useEntitySearchMulti(
    workspaceId,
    debouncedQuery,
    VECTOR_SEARCH_TYPES,
    'semantic'
  )

  const { keyword, semantic } = useMemo(() => {
    const q = trimmedQuery.toLowerCase().normalize('NFC')
    if (!q) return { keyword: allItems.slice(0, 50), semantic: [] as PickerItem[] }
    const tokens = q.split(/\s+/).filter(Boolean)
    const keyword = allItems
      .filter((i) => {
        const lower = i.title.toLowerCase().normalize('NFC')
        return tokens.every((t) => lower.includes(t))
      })
      .slice(0, 50)
    const kwSet = new Set(keyword.map((i) => `${i.domain}:${i.id}`))
    const semantic: PickerItem[] = []
    if (hits) {
      const seen = new Set<string>()
      for (const h of hits) {
        const domain = SEARCH_TO_DOMAIN[h.type]
        if (!domain) continue
        const k = `${domain}:${h.id}`
        if (kwSet.has(k) || seen.has(k)) continue
        const item = itemMap.get(k)
        if (item) {
          seen.add(k)
          semantic.push(item)
        }
      }
    }
    return { keyword, semantic }
  }, [allItems, trimmedQuery, hits, itemMap])

  const grouped = trimmedQuery.length > 0
  // 키보드 내비게이션용 평면 목록 (keyword 다음 semantic)
  const results = useMemo(
    () => (grouped ? [...keyword, ...semantic] : keyword),
    [grouped, keyword, semantic]
  )

  // query / open 변경 시 focusIndex reset — derived state 패턴.
  const [focusIndex, setFocusIndex] = useState(0)
  const [prevResetKey, setPrevResetKey] = useState({ query, open })
  if (prevResetKey.query !== query || prevResetKey.open !== open) {
    setPrevResetKey({ query, open })
    setFocusIndex(0)
  }

  // 키보드 이동 시 포커스 항목 자동 스크롤 (헤더가 섞이므로 data-idx 로 조회)
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${focusIndex}"]`) as HTMLElement | null
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [focusIndex])

  const [loading, getEditor] = useInstance()
  void loading

  /** 에디터(@ 위치)로 포커스 복귀 — ESC/외부클릭으로 닫을 때 노트 포커스 유지. */
  function refocusEditor(): void {
    const editor = getEditor()
    if (!editor) return
    editor.action((ctx) => {
      ctx.get(editorViewCtx).focus()
    })
  }

  function handleSelect(item: PickerItem): void {
    const editor = getEditor()
    if (!editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const schema = view.state.schema
      const embedType = schema.nodes[RALLY_EMBED_NODE_NAME]
      if (!embedType) return
      // 기본 height — note/canvas: 0 (inline 링크), csv: 0 (콘텐츠 크기), pdf/image: 고정.
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
      setFocusIndex((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = results[focusIndex]
      if (item) handleSelect(item)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closePicker()
      refocusEditor()
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

  const headerClass =
    'px-2 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground'
  const mutedClass = 'text-xs text-muted-foreground text-center py-2'

  const renderItem = (item: PickerItem, i: number): React.JSX.Element => {
    const Icon = ICONS[item.domain]
    const isFocus = i === focusIndex
    return (
      <button
        key={`${item.domain}:${item.id}`}
        type="button"
        data-idx={i}
        onClick={() => handleSelect(item)}
        onMouseEnter={() => setFocusIndex(i)}
        className={
          'w-full flex items-center gap-2 text-xs rounded px-2 py-1.5 text-left cursor-pointer ' +
          (isFocus ? 'bg-accent text-accent-foreground' : 'hover:bg-accent')
        }
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate flex-1 min-w-0">{item.title}</span>
        <span className="text-[10px] text-muted-foreground shrink-0">{item.domain}</span>
        {isFocus && <Check className="size-3 text-primary shrink-0" />}
      </button>
    )
  }

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
      {/* radix viewport 내부 wrapper 가 display:table 이라 긴 제목 시 콘텐츠가 폭을 넘겨 밀림.
          [&>div]:!block 으로 block 강제 → w-full 자식이 viewport 폭에 맞춰지고 truncate 동작. */}
      <ScrollArea viewportClassName="max-h-60 [&>div]:!block">
        <div ref={listRef} className="w-full">
          {!grouped ? (
            results.length === 0 ? (
              <div className={mutedClass}>결과 없음</div>
            ) : (
              results.map((item, i) => renderItem(item, i))
            )
          ) : (
            <>
              <div className={headerClass}>일반 검색</div>
              {keyword.length === 0 ? (
                <div className={mutedClass}>일치하는 제목 없음</div>
              ) : (
                keyword.map((item, i) => renderItem(item, i))
              )}
              <div className={headerClass}>벡터 검색</div>
              {semanticLoading && semantic.length === 0 ? (
                <div className={mutedClass}>검색 중…</div>
              ) : semantic.length === 0 ? (
                <div className={mutedClass}>관련 항목 없음</div>
              ) : (
                semantic.map((item, j) => renderItem(item, keyword.length + j))
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

import {
  JSX,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, FileText, Sheet, Image as ImageIcon, Network, Loader2, Repeat2 } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ScrollArea, ScrollBar } from '@shared/ui/scroll-area'
import { useHistoryInfinite, type HistoryLink, type HistoryTodoEntry } from '@entities/history'
import { useTabStore } from '@/features/tap-system/manage-tab-system'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import { cn } from '@shared/lib/utils'
import { HighlightText } from '../lib/highlight'
import { linkToTabOptions } from '../lib/link-to-tab'

interface Props {
  workspaceId: string
  query: string
  fromDate: string | null
  toDate: string | null
}

const LINK_ICON: Record<HistoryLink['type'], React.ElementType> = {
  note: FileText,
  csv: Sheet,
  pdf: PdfIcon,
  image: ImageIcon,
  canvas: Network
}

const LINK_ICON_COLOR: Record<HistoryLink['type'], string> = {
  note: '#3b82f6',
  csv: '#10b981',
  pdf: '#ef4444',
  image: '#f59e0b',
  canvas: '#a855f7'
}

/** ScrollArea Viewport ref를 자손 motion에 전달 (whileInView root) */
const ScrollViewportContext = createContext<RefObject<HTMLElement | null> | null>(null)

export function HistoryTimeline({ workspaceId, query, fromDate, toDate }: Props): JSX.Element {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useHistoryInfinite({
      workspaceId,
      query,
      fromDate,
      toDate
    })

  const sentinelRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLElement | null>(null)

  // ScrollArea Viewport 요소를 찾아 whileInView root로 사용
  useEffect(() => {
    const el = wrapperRef.current?.closest('[data-slot="scroll-area-viewport"]')
    viewportRef.current = (el as HTMLElement) ?? null
  }, [])

  const allDays = useMemo(() => data?.pages.flatMap((p) => p.days) ?? [], [data])

  // 무한 스크롤
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '120px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <ScrollViewportContext.Provider value={viewportRef}>
      <ScrollArea className="h-full">
        <div
          ref={wrapperRef}
          className="relative min-w-[800px] py-6 pl-16 pr-4"
          style={{
            backgroundImage:
              'radial-gradient(circle, color-mix(in srgb, var(--border) 35%, transparent) 1px, transparent 1px)',
            backgroundSize: '16px 16px'
          }}
        >
          {/* 좌측 세로 spine (timeline backbone) */}
          {allDays.length > 0 && (
            <div className="absolute left-6 top-6 bottom-6 border-l border-dashed border-border" />
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          )}

          {isError && (
            <div className="text-center text-sm text-destructive py-12">
              히스토리를 불러오는 중 오류가 발생했습니다.
            </div>
          )}

          {!isLoading && allDays.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">
              {query || fromDate || toDate
                ? '조건에 맞는 항목이 없습니다.'
                : '완료된 할 일이 없습니다.'}
            </div>
          )}

          <div className="flex flex-col gap-6">
            <AnimatePresence>
              {allDays.map((day) => (
                <DaySection key={day.date} date={day.date} todos={day.todos} query={query} />
              ))}
            </AnimatePresence>
          </div>

          {hasNextPage && (
            <div ref={sentinelRef} className="flex items-center justify-center py-6">
              {isFetchingNextPage && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </ScrollViewportContext.Provider>
  )
}

function DaySection({
  date,
  todos,
  query
}: {
  date: string
  todos: HistoryTodoEntry[]
  query: string
}): JSX.Element {
  const dateObj = useMemo(() => {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1)
  }, [date])

  return (
    <motion.div
      className="flex flex-col gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* 날짜 라벨 + spine 가지 */}
      <div className="sticky top-0 z-10 relative h-6 flex items-center">
        <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-8 border-t border-dashed border-border" />
        <div className="absolute -left-[48px] top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-foreground/60 bg-background" />
        <span className="text-xs font-semibold text-foreground/80 tracking-wide bg-background px-2 py-0.5 rounded">
          {format(dateObj, 'yyyy.MM.dd (eee)', { locale: ko })}
        </span>
      </div>
      <AnimatePresence>
        {todos.map((todo) => (
          <TodoRow key={todo.id} todo={todo} query={query} />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

function TodoRow({ todo, query }: { todo: HistoryTodoEntry; query: string }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const todoRef = useRef<HTMLDivElement>(null)
  const linkRefs = useRef<Array<HTMLDivElement | null>>([])
  const [paths, setPaths] = useState<string[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const viewportRef = useContext(ScrollViewportContext)

  const linkCount = todo.links.length

  const measure = useCallback((): void => {
    const container = containerRef.current
    const todoEl = todoRef.current
    if (!container || !todoEl) return
    const cRect = container.getBoundingClientRect()
    const tRect = todoEl.getBoundingClientRect()
    // 양 끝을 노드 안쪽으로 1px overshoot — 측정 sub-pixel 오차 보정 + 시각 연결 보장
    const startX = tRect.right - cRect.left - 1
    const startY = tRect.top + tRect.height / 2 - cRect.top
    const newPaths: string[] = []
    for (let i = 0; i < linkCount; i++) {
      const el = linkRefs.current[i]
      if (!el) {
        newPaths.push('')
        continue
      }
      const lRect = el.getBoundingClientRect()
      const endX = lRect.left - cRect.left + 1
      const endY = lRect.top + lRect.height / 2 - cRect.top
      const dx = endX - startX
      const offset = Math.max(24, Math.abs(dx) * 0.5)
      newPaths.push(
        `M ${startX} ${startY} C ${startX + offset} ${startY}, ${endX - offset} ${endY}, ${endX} ${endY}`
      )
    }
    setPaths(newPaths)
    setSize({ width: cRect.width, height: cRect.height })
  }, [linkCount])

  useLayoutEffect(() => {
    // DOM 측정 후 SVG path/size state 업데이트 — 외부(DOM) → React 동기화 패턴
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure()
    // 폰트/이미지 로딩 등으로 인한 후속 layout shift 대응: 다음 frame 재측정
    const raf = requestAnimationFrame(() => measure())
    return () => cancelAnimationFrame(raf)
  }, [measure])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(container)
    // 각 link도 observe — 텍스트 reflow 등에 대응
    for (const el of linkRefs.current) {
      if (el) ro.observe(el)
    }
    return () => ro.disconnect()
  }, [measure, linkCount])

  return (
    <motion.div
      ref={containerRef}
      className="relative flex items-start gap-20"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      viewport={{
        once: true,
        amount: 0.2,
        root: viewportRef ?? undefined
      }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* todo 노드 (좌측) */}
      <div ref={todoRef} className="w-[250px] shrink-0">
        <TodoNode title={todo.title} doneAt={todo.doneAt} kind={todo.kind} query={query} />
      </div>

      {/* 링크 노드 (우측) — 없으면 빈 채로 둠 */}
      <div className="flex-1 min-w-0">
        {linkCount > 0 && (
          <div className="flex flex-col gap-2">
            <AnimatePresence>
              {todo.links.map((link, i) => (
                <motion.div
                  key={`${link.type}-${link.id}`}
                  ref={(el) => {
                    linkRefs.current[i] = el
                  }}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  viewport={{
                    once: true,
                    amount: 0.2,
                    root: viewportRef ?? undefined
                  }}
                  transition={{ duration: 0.3, ease: 'easeOut', delay: 0.12 + i * 0.06 }}
                  className="w-fit"
                >
                  <LinkNode link={link} query={query} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* SVG 곡선 연결 (todo 우측 → 각 link 좌측) */}
      {linkCount > 0 && size.width > 0 && (
        <svg
          className="absolute top-0 left-0 pointer-events-none text-border"
          width={size.width}
          height={size.height}
        >
          <AnimatePresence>
            {todo.links.map((link, i) => {
              const d = paths[i]
              if (!d) return null
              return (
                <motion.path
                  key={`${link.type}-${link.id}`}
                  d={d}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  fill="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut', delay: 0.18 + i * 0.06 }}
                />
              )
            })}
          </AnimatePresence>
        </svg>
      )}
    </motion.div>
  )
}

function TodoNode({
  title,
  doneAt,
  kind,
  query
}: {
  title: string
  doneAt: Date
  kind: 'todo' | 'recurring'
  query: string
}): JSX.Element {
  const isRecurring = kind === 'recurring'
  const Icon = isRecurring ? Repeat2 : Check
  const iconColor = isRecurring ? 'text-violet-500' : 'text-emerald-500'

  return (
    <div
      className={cn(
        'flex items-start gap-2 px-3 py-2 rounded-md border bg-background shadow-md',
        'text-sm cursor-default select-none'
      )}
    >
      <Icon className={cn('size-3.5 shrink-0 mt-0.5', iconColor)} />
      <div className="min-w-0 flex-1">
        <div className="truncate">
          <HighlightText text={title} query={query} />
        </div>
        <div className="text-[10px] text-muted-foreground/70 tabular-nums mt-0.5">
          {format(doneAt, 'a h:mm', { locale: ko })}
        </div>
      </div>
    </div>
  )
}

function LinkNode({ link, query }: { link: HistoryLink; query: string }): JSX.Element {
  const openTab = useTabStore((s) => s.openTab)
  const Icon = LINK_ICON[link.type]
  const color = LINK_ICON_COLOR[link.type]

  const handleClick = (): void => {
    const opts = linkToTabOptions(link)
    if (opts) openTab(opts)
  }

  const hasDesc = !!link.description?.trim()

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'group flex items-start gap-2 px-3 py-2 rounded-md border bg-background shadow-md',
        'text-sm text-left max-w-xl w-fit',
        'hover:bg-accent hover:border-accent-foreground/20 transition-colors cursor-pointer'
      )}
    >
      <Icon className="size-3.5 shrink-0 mt-0.5" style={{ color }} />
      <div className="min-w-0 flex-1">
        <div className="truncate">
          <HighlightText text={link.title} query={query} />
        </div>
        {hasDesc && (
          <div className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
            {link.description}
          </div>
        )}
      </div>
    </button>
  )
}

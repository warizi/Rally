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
import { useDraggable } from '@dnd-kit/core'
import { Check, CornerDownRight, Loader2, Repeat2 } from 'lucide-react'
import { ENTITY_ICON, ENTITY_ICON_COLOR } from '@shared/constants/entity-icon'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ScrollArea, ScrollBar } from '@shared/ui/scroll-area'
import { useHistoryInfinite, type HistoryLink, type HistoryTodoEntry } from '@entities/history'
import { useTabStore } from '@/features/tap-system/manage-tab-system'
import { cn } from '@shared/lib/utils'
import { HighlightText } from '../lib/highlight'
import { linkToTabOptions } from '../lib/link-to-tab'
import {
  buildHistoryLinkDragId,
  type HistoryLinkDragData
} from '../lib/history-link-drag'

interface Props {
  workspaceId: string
  query: string
  fromDate: string | null
  toDate: string | null
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

  // parent + 같은 day에 완료된 sub들을 한 GroupRow로 묶는다.
  // service에서 sub는 parent 직후로 정렬되어 들어오므로 순차 스캔으로 충분.
  const groups = useMemo<HistoryTodoEntry[][]>(() => {
    const result: HistoryTodoEntry[][] = []
    let headId: string | null = null
    for (const todo of todos) {
      const inGroup = todo.parentId != null && todo.parentId === headId
      if (inGroup) {
        result[result.length - 1]!.push(todo)
      } else {
        result.push([todo])
        headId = todo.id
      }
    }
    return result
  }, [todos])

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
        {groups.map((group) => (
          <GroupRow key={group[0]!.id} entries={group} query={query} />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * 한 그룹(부모 + 같은 day의 sub들)을 하나의 row로 렌더링.
 *
 * - 좌측 컬럼: 모든 entry를 세로 스택 (sub는 들여쓰기)
 * - 우측 컬럼: 모든 entry의 link들을 평탄화하여 하나의 세로 스택
 * - SVG: 각 entry → 그 entry의 link들로 베지어 곡선 연결
 *
 * 부모에 link가 많아 row가 길어져도 sub는 좌측에서 부모 바로 아래로 붙어 표시된다.
 */
function GroupRow({
  entries,
  query
}: {
  entries: HistoryTodoEntry[]
  query: string
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const todoRefs = useRef<Array<HTMLDivElement | null>>([])
  // entry index와 무관하게 link key로 ref 저장 — 평탄화된 우측 list와 entry 순회를 분리
  const linkRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const [paths, setPaths] = useState<string[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const viewportRef = useContext(ScrollViewportContext)

  // 평탄화된 (entry, link, key) 목록 — 우측 컬럼 렌더 + SVG path 생성에 공통 사용
  const flatLinks = useMemo(() => {
    const list: { entryIndex: number; link: HistoryLink; key: string }[] = []
    entries.forEach((entry, ei) => {
      entry.links.forEach((link) => {
        list.push({ entryIndex: ei, link, key: `${entry.id}|${link.type}-${link.id}` })
      })
    })
    return list
  }, [entries])

  const measure = useCallback((): void => {
    const container = containerRef.current
    if (!container) return
    const cRect = container.getBoundingClientRect()
    const newPaths: string[] = flatLinks.map(({ entryIndex, key }) => {
      const todoEl = todoRefs.current[entryIndex]
      const linkEl = linkRefs.current.get(key)
      if (!todoEl || !linkEl) return ''
      const tRect = todoEl.getBoundingClientRect()
      const lRect = linkEl.getBoundingClientRect()
      const startX = tRect.right - cRect.left - 1
      const startY = tRect.top + tRect.height / 2 - cRect.top
      const endX = lRect.left - cRect.left + 1
      const endY = lRect.top + lRect.height / 2 - cRect.top
      const dx = endX - startX
      const offset = Math.max(24, Math.abs(dx) * 0.5)
      return `M ${startX} ${startY} C ${startX + offset} ${startY}, ${endX - offset} ${endY}, ${endX} ${endY}`
    })
    setPaths(newPaths)
    setSize({ width: cRect.width, height: cRect.height })
  }, [flatLinks])

  useLayoutEffect(() => {
    // DOM 측정 후 SVG path/size state 업데이트 — 외부(DOM) → React 동기화 패턴
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure()
    const raf = requestAnimationFrame(() => measure())
    return () => cancelAnimationFrame(raf)
  }, [measure])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(container)
    for (const el of linkRefs.current.values()) {
      if (el) ro.observe(el)
    }
    for (const el of todoRefs.current) {
      if (el) ro.observe(el)
    }
    return () => ro.disconnect()
  }, [measure, flatLinks])

  return (
    <motion.div
      ref={containerRef}
      className="relative flex items-start gap-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* 좌측: parent + sub 노드 스택 — entry 단위로 슬라이드 + stagger */}
      <div className="w-[260px] shrink-0 flex flex-col gap-2">
        {entries.map((entry, ei) => {
          const isSub = entry.parentId != null
          return (
            <motion.div
              key={entry.id}
              ref={(el) => {
                todoRefs.current[ei] = el
              }}
              className={cn(isSub && 'pl-8')}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              viewport={{
                once: true,
                amount: 0.2,
                root: viewportRef ?? undefined
              }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: ei * 0.06 }}
            >
              <TodoNode
                title={entry.title}
                doneAt={entry.doneAt}
                kind={entry.kind}
                query={query}
                parentTitle={entry.parentTitle}
              />
            </motion.div>
          )
        })}
      </div>

      {/* 우측: 모든 entry의 link를 평탄화하여 스택 */}
      <div className="flex-1 min-w-0">
        {flatLinks.length > 0 && (
          <div className="flex flex-col gap-2">
            <AnimatePresence>
              {flatLinks.map(({ link, key }, i) => (
                <motion.div
                  key={key}
                  ref={(el) => {
                    if (el) linkRefs.current.set(key, el)
                    else linkRefs.current.delete(key)
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

      {/* SVG 곡선 — 각 entry → 그 entry의 link들 */}
      {flatLinks.length > 0 && size.width > 0 && (
        <svg
          className="absolute top-0 left-0 pointer-events-none text-border"
          width={size.width}
          height={size.height}
        >
          <AnimatePresence>
            {flatLinks.map(({ key }, i) => {
              const d = paths[i]
              if (!d) return null
              return (
                <motion.path
                  key={key}
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
  query,
  parentTitle
}: {
  title: string
  doneAt: Date
  kind: 'todo' | 'recurring'
  query: string
  parentTitle: string | null
}): JSX.Element {
  const isRecurring = kind === 'recurring'
  const isSub = parentTitle != null
  const Icon = isSub ? CornerDownRight : isRecurring ? Repeat2 : Check
  const iconColor = isSub
    ? 'text-muted-foreground'
    : isRecurring
      ? 'text-violet-500'
      : 'text-emerald-500'

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border shadow-md cursor-default select-none',
        isSub ? 'bg-muted/40 px-2.5 py-1.5 text-xs' : 'bg-background px-3 py-2 text-sm'
      )}
    >
      <Icon className={cn('shrink-0 mt-0.5', isSub ? 'size-3' : 'size-3.5', iconColor)} />
      <div className="min-w-0 flex-1">
        {isSub && (
          <div className="text-[10px] text-muted-foreground/70 truncate leading-tight">
            {parentTitle}
          </div>
        )}
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
  const Icon = ENTITY_ICON[link.type]
  const color = ENTITY_ICON_COLOR[link.type]

  const dragData: HistoryLinkDragData = { source: 'history-link', link }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: buildHistoryLinkDragId(link),
    data: dragData
  })

  const handleClick = (): void => {
    const opts = linkToTabOptions(link)
    if (opts) openTab(opts)
  }

  const hasDesc = !!link.description?.trim()

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      className={cn(
        'group flex items-start gap-2 px-3 py-2 rounded-md border bg-background shadow-md',
        'text-sm text-left max-w-xl w-fit select-none',
        'hover:bg-accent hover:border-accent-foreground/20 transition-colors cursor-pointer',
        isDragging && 'opacity-30'
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
    </div>
  )
}

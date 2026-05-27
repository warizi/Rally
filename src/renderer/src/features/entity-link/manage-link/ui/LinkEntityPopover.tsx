import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Check, Link } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Input } from '@shared/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/tabs'
import { ScrollArea } from '@shared/ui/scroll-area'
import { useTodosByWorkspace } from '@entities/todo'
import { useAllSchedulesByWorkspace } from '@entities/schedule'
import { useNotesByWorkspace } from '@entities/note'
import { usePdfFilesByWorkspace } from '@entities/pdf-file'
import { useCsvFilesByWorkspace } from '@entities/csv-file'
import { useImageFilesByWorkspace } from '@entities/image-file'
import { useCanvasesByWorkspace } from '@entities/canvas'
import { useLinkedEntities, useLinkEntity, useUnlinkEntity } from '@entities/entity-link'
import type { LinkableEntityType } from '@shared/lib/entity-link'
import { ENTITY_TYPE_LABEL, ENTITY_TYPE_ICON } from '@shared/lib/entity-link'

interface Props {
  entityType: LinkableEntityType
  entityId: string
  workspaceId: string
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface EntityOption {
  type: LinkableEntityType
  id: string
  title: string
}

const LINKABLE_TABS: LinkableEntityType[] = [
  'todo',
  'schedule',
  'note',
  'pdf',
  'csv',
  'image',
  'canvas'
]

export function LinkEntityPopover({
  entityType,
  entityId,
  workspaceId,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: Props): React.JSX.Element {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = controlledOnOpenChange ?? setInternalOpen

  function handleOpenChange(next: boolean): void {
    setOpen(next)
  }
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<LinkableEntityType>(() => {
    const firstOther = LINKABLE_TABS.find((t) => t !== entityType)
    return firstOther ?? 'todo'
  })

  const { data: linked = [] } = useLinkedEntities(entityType, entityId)
  const linkEntity = useLinkEntity()
  const unlinkEntity = useUnlinkEntity()

  const { data: todos = [] } = useTodosByWorkspace(workspaceId)
  const { data: schedules = [] } = useAllSchedulesByWorkspace(workspaceId)
  const { data: notes = [] } = useNotesByWorkspace(workspaceId)
  const { data: pdfs = [] } = usePdfFilesByWorkspace(workspaceId)
  const { data: csvs = [] } = useCsvFilesByWorkspace(workspaceId)
  const { data: images = [] } = useImageFilesByWorkspace(workspaceId)
  const { data: canvasList = [] } = useCanvasesByWorkspace(workspaceId)

  const linkedSet = useMemo(() => {
    const s = new Set<string>()
    for (const l of linked) s.add(`${l.entityType}:${l.entityId}`)
    return s
  }, [linked])

  const optionsByType = useMemo((): Record<LinkableEntityType, EntityOption[]> => {
    const excludeSelf = <T extends EntityOption>(items: T[]): T[] =>
      items.filter((item) => !(item.type === entityType && item.id === entityId))
    return {
      todo: excludeSelf(
        todos.filter((t) => !t.parentId).map((t) => ({ type: 'todo', id: t.id, title: t.title }))
      ),
      schedule: excludeSelf(schedules.map((s) => ({ type: 'schedule', id: s.id, title: s.title }))),
      note: excludeSelf(notes.map((n) => ({ type: 'note', id: n.id, title: n.title }))),
      pdf: excludeSelf(pdfs.map((p) => ({ type: 'pdf', id: p.id, title: p.title }))),
      csv: excludeSelf(csvs.map((c) => ({ type: 'csv', id: c.id, title: c.title }))),
      image: excludeSelf(images.map((i) => ({ type: 'image', id: i.id, title: i.title }))),
      canvas: excludeSelf(canvasList.map((c) => ({ type: 'canvas', id: c.id, title: c.title })))
    }
  }, [todos, schedules, notes, pdfs, csvs, images, canvasList, entityType, entityId])

  const filtered = useMemo(() => {
    const items = optionsByType[activeTab] ?? []
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => item.title.toLowerCase().includes(q))
  }, [optionsByType, activeTab, search])

  const handleToggleLink = useCallback(
    (target: EntityOption): void => {
      if (linkedSet.has(`${target.type}:${target.id}`)) {
        unlinkEntity.mutate({
          typeA: entityType,
          idA: entityId,
          typeB: target.type,
          idB: target.id
        })
      } else {
        linkEntity.mutate({
          typeA: entityType,
          idA: entityId,
          typeB: target.type,
          idB: target.id,
          workspaceId
        })
      }
    },
    [linkedSet, entityType, entityId, workspaceId, linkEntity, unlinkEntity]
  )

  const availableTabs = LINKABLE_TABS

  // --- Keyboard navigation ---
  // 두 가지 focus 모드:
  // - input mode: 검색 input 에 focus, focusIndex = -1, 좌우는 input cursor 이동
  // - list mode: list wrapper 에 focus, focusIndex >= 0, 좌우는 탭 전환
  const [focusIndex, setFocusIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listWrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset focus when filtered list or tab changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocusIndex(-1)
  }, [filtered.length, activeTab])

  // Scroll focused item into view
  useEffect(() => {
    if (focusIndex < 0 || !listRef.current) return
    const el = listRef.current.children[focusIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [focusIndex])

  function focusInputMode(): void {
    setFocusIndex(-1)
    inputRef.current?.focus()
  }

  function focusListMode(initialIdx: number): void {
    setFocusIndex(initialIdx)
    listWrapperRef.current?.focus()
  }

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // 좌우 = input cursor 이동 (default 동작 유지)
      // 상하 = list 모드 전환
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (filtered.length === 0) return
        const initialIdx = e.key === 'ArrowDown' ? 0 : filtered.length - 1
        focusListMode(initialIdx)
      }
      // Tab / Enter / Escape / ArrowLeft / ArrowRight: input 기본 동작 유지
    },
    [filtered.length]
  )

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Tab') {
        // list 모드에서 Tab 무시 (popup 내 element 간 순환 없음)
        e.preventDefault()
        return
      }
      // ESC 는 PopoverContent.onEscapeKeyDown 에서 일괄 처리
      // (list mode → input 복귀 / input mode → popup 닫힘)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const idx = availableTabs.indexOf(activeTab)
        const next =
          e.key === 'ArrowRight'
            ? availableTabs[(idx + 1) % availableTabs.length]
            : availableTabs[(idx - 1 + availableTabs.length) % availableTabs.length]
        setActiveTab(next)
        // 탭 변경으로 이전 활성 wrapper 가 hidden 되며 focus 잃음. 새 활성 wrapper
        // 가 mount + visible 된 이후 (다음 paint) 에 ref 통해 focus 회수.
        requestAnimationFrame(() => {
          listWrapperRef.current?.focus()
        })
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        // 탭 변경 직후 (focusIndex = -1 로 리셋된 상태) 에서 ArrowDown 누르면
        // 검색바로 복귀. 그 외 케이스는 다음 항목으로 이동.
        if (focusIndex < 0) {
          focusInputMode()
          return
        }
        if (filtered.length === 0) return
        setFocusIndex(focusIndex < filtered.length - 1 ? focusIndex + 1 : 0)
        return
      }
      if (filtered.length === 0) return
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (focusIndex <= 0) {
          // 첫 항목에서 ArrowUp 더 누르면 input 복귀
          focusInputMode()
        } else {
          setFocusIndex(focusIndex - 1)
        }
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (focusIndex >= 0 && focusIndex < filtered.length) {
          handleToggleLink(filtered[focusIndex])
        }
        return
      }
    },
    [filtered, focusIndex, handleToggleLink, availableTabs, activeTab]
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {children ?? (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Link className="size-3" />
            <span>연결</span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[28rem] p-2"
        // popup 열림 시 Radix 기본 동작은 첫 focusable (TabsTrigger) 에 focus
        // → ArrowDown 이 잡히지 않음. 검색 input 으로 명시 focus.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
        // ESC: list mode 면 popup 닫지 말고 input 으로 복귀. input mode 면
        // 기본 동작(popup 닫힘) 유지.
        onEscapeKeyDown={(e) => {
          if (focusIndex >= 0) {
            e.preventDefault()
            focusInputMode()
          }
        }}
        // popup 내부 spacebar 가 부모의 dnd-kit keyboard sensor 까지 bubble 되면
        // popup 을 띄운 카드가 drag 모드로 전환되는 버그. popup 경계에서 차단.
        onKeyDown={(e) => {
          if (e.key === ' ') e.stopPropagation()
        }}
      >
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LinkableEntityType)}>
          <TabsList className="w-full h-7 mb-2">
            {availableTabs.map((tab) => {
              const TabIcon = ENTITY_TYPE_ICON[tab]
              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  title={ENTITY_TYPE_LABEL[tab]}
                  className="text-xs flex-1 h-6 px-1 gap-1 min-w-0"
                >
                  <TabIcon className="size-3 shrink-0" />
                  <span className="truncate">{ENTITY_TYPE_LABEL[tab]}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          <Input
            ref={inputRef}
            placeholder="검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="mb-2 h-7 text-xs"
          />

          {availableTabs.map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-0">
              <div
                ref={tab === activeTab ? listWrapperRef : undefined}
                tabIndex={-1}
                onKeyDown={tab === activeTab ? handleListKeyDown : undefined}
                className="outline-none"
              >
                <ScrollArea className="h-[200px]">
                  <div ref={tab === activeTab ? listRef : undefined}>
                    {filtered.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        항목이 없습니다
                      </div>
                    ) : (
                      filtered.map((item, i) => {
                        const isLinked = linkedSet.has(`${item.type}:${item.id}`)
                        const isFocused = focusIndex === i
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleToggleLink(item)}
                            onMouseEnter={() => setFocusIndex(i)}
                            className={`
                            w-full flex items-center gap-2 text-xs rounded px-2 py-1.5 text-left
                            ${isFocused ? (isLinked ? 'bg-destructive/10' : 'bg-accent') : ''}
                            ${!isFocused && isLinked ? 'hover:bg-destructive/10' : ''}
                            ${!isFocused && !isLinked ? 'hover:bg-accent' : ''}
                            cursor-pointer
                          `}
                          >
                            {isLinked && <Check className="size-3 text-primary shrink-0" />}
                            <span className={`truncate ${isLinked ? 'text-muted-foreground' : ''}`}>
                              {item.title}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

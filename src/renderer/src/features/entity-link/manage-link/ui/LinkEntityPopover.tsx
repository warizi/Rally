import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Check, Link } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Input } from '@shared/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/tabs'
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
        todos
          .filter((t) => !t.parentId)
          .map((t) => ({ type: 'todo', id: t.id, title: t.title }))
      ),
      schedule: excludeSelf(
        schedules.map((s) => ({ type: 'schedule', id: s.id, title: s.title }))
      ),
      note: excludeSelf(notes.map((n) => ({ type: 'note', id: n.id, title: n.title }))),
      pdf: excludeSelf(pdfs.map((p) => ({ type: 'pdf', id: p.id, title: p.title }))),
      csv: excludeSelf(csvs.map((c) => ({ type: 'csv', id: c.id, title: c.title }))),
      image: excludeSelf(images.map((i) => ({ type: 'image', id: i.id, title: i.title }))),
      canvas: excludeSelf(canvasList.map((c) => ({ type: 'canvas', id: c.id, title: c.title })))
    }
  }, [todos, schedules, notes, pdfs, csvs, images, canvasList, entityType, entityId])

  const filtered = useMemo(() => {
    const items = optionsByType[activeTab] ?? []
    if (!search.trim()) return items
    const q = search.toLowerCase()
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
  const [focusIndex, setFocusIndex] = useState(-1)
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const idx = availableTabs.indexOf(activeTab)
        const next =
          e.key === 'ArrowRight'
            ? availableTabs[(idx + 1) % availableTabs.length]
            : availableTabs[(idx - 1 + availableTabs.length) % availableTabs.length]
        setActiveTab(next)
        return
      }
      if (filtered.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusIndex((i) => (i < filtered.length - 1 ? i + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusIndex((i) => (i > 0 ? i - 1 : filtered.length - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (focusIndex >= 0 && focusIndex < filtered.length) {
          handleToggleLink(filtered[focusIndex])
        }
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
      <PopoverContent align="start" className="w-[28rem] p-2">
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
            placeholder="검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="mb-2 h-7 text-xs"
          />

          {availableTabs.map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-0">
              <div
                ref={tab === activeTab ? listRef : undefined}
                className="h-[200px] overflow-y-auto"
              >
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
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

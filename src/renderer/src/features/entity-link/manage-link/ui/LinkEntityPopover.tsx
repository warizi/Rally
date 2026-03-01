import { useState, useMemo } from 'react'
import { Check, Link } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Input } from '@shared/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/tabs'
import { useTodosByWorkspace } from '@entities/todo'
import { useAllSchedulesByWorkspace } from '@entities/schedule'
import { useNotesByWorkspace } from '@entities/note'
import { usePdfFilesByWorkspace } from '@entities/pdf-file'
import { useCsvFilesByWorkspace } from '@entities/csv-file'
import { useLinkedEntities, useLinkEntity } from '@entities/entity-link'
import type { LinkableEntityType } from '@shared/lib/entity-link'
import { ENTITY_TYPE_LABEL, ENTITY_TYPE_ICON } from '@shared/lib/entity-link'

interface Props {
  entityType: LinkableEntityType
  entityId: string
  workspaceId: string
  children?: React.ReactNode
  onClose?: () => void
}

interface EntityOption {
  type: LinkableEntityType
  id: string
  title: string
}

const LINKABLE_TABS: LinkableEntityType[] = ['todo', 'schedule', 'note', 'pdf', 'csv']

export function LinkEntityPopover({
  entityType,
  entityId,
  workspaceId,
  children,
  onClose
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)

  function handleOpenChange(next: boolean): void {
    setOpen(next)
    if (!next) onClose?.()
  }
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<LinkableEntityType>(() => {
    const firstOther = LINKABLE_TABS.find((t) => t !== entityType)
    return firstOther ?? 'todo'
  })

  const { data: linked = [] } = useLinkedEntities(entityType, entityId)
  const linkEntity = useLinkEntity()

  const { data: todos = [] } = useTodosByWorkspace(workspaceId)
  const { data: schedules = [] } = useAllSchedulesByWorkspace(workspaceId)
  const { data: notes = [] } = useNotesByWorkspace(workspaceId)
  const { data: pdfs = [] } = usePdfFilesByWorkspace(workspaceId)
  const { data: csvs = [] } = useCsvFilesByWorkspace(workspaceId)

  const linkedSet = useMemo(() => {
    const s = new Set<string>()
    for (const l of linked) s.add(`${l.entityType}:${l.entityId}`)
    // exclude self
    s.add(`${entityType}:${entityId}`)
    return s
  }, [linked, entityType, entityId])

  const optionsByType = useMemo((): Record<LinkableEntityType, EntityOption[]> => {
    return {
      todo: todos
        .filter((t) => !t.parentId)
        .map((t) => ({ type: 'todo', id: t.id, title: t.title })),
      schedule: schedules.map((s) => ({ type: 'schedule', id: s.id, title: s.title })),
      note: notes.map((n) => ({ type: 'note', id: n.id, title: n.title })),
      pdf: pdfs.map((p) => ({ type: 'pdf', id: p.id, title: p.title })),
      csv: csvs.map((c) => ({ type: 'csv', id: c.id, title: c.title }))
    }
  }, [todos, schedules, notes, pdfs, csvs])

  const filtered = useMemo(() => {
    const items = optionsByType[activeTab] ?? []
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((item) => item.title.toLowerCase().includes(q))
  }, [optionsByType, activeTab, search])

  function handleLink(target: EntityOption): void {
    if (linkedSet.has(`${target.type}:${target.id}`)) return
    linkEntity.mutate({
      typeA: entityType,
      idA: entityId,
      typeB: target.type,
      idB: target.id,
      workspaceId
    })
  }

  const availableTabs = LINKABLE_TABS.filter((t) => t !== entityType)

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
      <PopoverContent align="start" className="w-72 p-2">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LinkableEntityType)}>
          <TabsList className="w-full h-7 mb-2">
            {availableTabs.map((tab) => {
              const TabIcon = ENTITY_TYPE_ICON[tab]
              return (
                <TabsTrigger key={tab} value={tab} className="text-xs flex-1 h-6 px-1.5 gap-1">
                  <TabIcon className="size-3" />
                  {ENTITY_TYPE_LABEL[tab]}
                </TabsTrigger>
              )
            })}
          </TabsList>

          <Input
            placeholder="검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 h-7 text-xs"
          />

          {availableTabs.map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-0">
              <div className="max-h-48 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    항목이 없습니다
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filtered.map((item) => {
                      const isLinked = linkedSet.has(`${item.type}:${item.id}`)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={isLinked}
                          onClick={() => handleLink(item)}
                          className={`
                            w-full flex items-center gap-2 text-xs rounded px-2 py-1.5 text-left
                            ${isLinked ? 'opacity-50 cursor-default' : 'hover:bg-accent cursor-pointer'}
                          `}
                        >
                          {isLinked && <Check className="size-3 text-primary shrink-0" />}
                          <span className="truncate">{item.title}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

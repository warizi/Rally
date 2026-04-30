import { useState, useMemo } from 'react'
import { Check, Link, X } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/tabs'
import { useTodosByWorkspace } from '@entities/todo'
import { useAllSchedulesByWorkspace } from '@entities/schedule'
import { useNotesByWorkspace } from '@entities/note'
import { usePdfFilesByWorkspace } from '@entities/pdf-file'
import { useCsvFilesByWorkspace } from '@entities/csv-file'
import { useImageFilesByWorkspace } from '@entities/image-file'
import { useCanvasesByWorkspace } from '@entities/canvas'
import type { LinkableEntityType } from '@shared/lib/entity-link'
import { ENTITY_TYPE_LABEL, ENTITY_TYPE_ICON } from '@shared/lib/entity-link'

export interface PendingLink {
  type: LinkableEntityType
  id: string
  title: string
}

interface Props {
  workspaceId: string
  excludeType: LinkableEntityType
  selected: PendingLink[]
  onAdd: (link: PendingLink) => void
  onRemove: (link: PendingLink) => void
}

interface EntityOption {
  type: LinkableEntityType
  id: string
  title: string
}

const ALL_TABS: LinkableEntityType[] = ['todo', 'schedule', 'note', 'pdf', 'csv', 'image', 'canvas']

export function PendingLinkPicker({
  workspaceId,
  excludeType,
  selected,
  onAdd,
  onRemove
}: Props): React.JSX.Element {
  const availableTabs = ALL_TABS
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<LinkableEntityType>(
    () => ALL_TABS.find((t) => t !== excludeType) ?? ALL_TABS[0]
  )

  const { data: todos = [] } = useTodosByWorkspace(workspaceId)
  const { data: schedules = [] } = useAllSchedulesByWorkspace(workspaceId)
  const { data: notes = [] } = useNotesByWorkspace(workspaceId)
  const { data: pdfs = [] } = usePdfFilesByWorkspace(workspaceId)
  const { data: csvs = [] } = useCsvFilesByWorkspace(workspaceId)
  const { data: images = [] } = useImageFilesByWorkspace(workspaceId)
  const { data: canvases = [] } = useCanvasesByWorkspace(workspaceId)

  const selectedSet = useMemo(() => {
    const s = new Set<string>()
    for (const l of selected) s.add(`${l.type}:${l.id}`)
    return s
  }, [selected])

  const optionsByType = useMemo(
    (): Record<LinkableEntityType, EntityOption[]> => ({
      todo: todos
        .filter((t) => !t.parentId)
        .map((t) => ({ type: 'todo', id: t.id, title: t.title })),
      schedule: schedules.map((s) => ({ type: 'schedule', id: s.id, title: s.title })),
      note: notes.map((n) => ({ type: 'note', id: n.id, title: n.title })),
      pdf: pdfs.map((p) => ({ type: 'pdf', id: p.id, title: p.title })),
      csv: csvs.map((c) => ({ type: 'csv', id: c.id, title: c.title })),
      image: images.map((i) => ({ type: 'image', id: i.id, title: i.title })),
      canvas: canvases.map((c) => ({ type: 'canvas', id: c.id, title: c.title }))
    }),
    [todos, schedules, notes, pdfs, csvs, images, canvases]
  )

  const filtered = useMemo(() => {
    const items = optionsByType[activeTab] ?? []
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((item) => item.title.toLowerCase().includes(q))
  }, [optionsByType, activeTab, search])

  function handleToggle(item: EntityOption): void {
    const key = `${item.type}:${item.id}`
    if (selectedSet.has(key)) {
      onRemove(item)
    } else {
      onAdd(item)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Link className="size-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">연결</span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 ml-auto">
              + 추가
            </Button>
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
                          const isSelected = selectedSet.has(`${item.type}:${item.id}`)
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleToggle(item)}
                              className={`
                                w-full flex items-center gap-2 text-xs rounded px-2 py-1.5 text-left
                                ${isSelected ? 'bg-accent' : 'hover:bg-accent cursor-pointer'}
                              `}
                            >
                              {isSelected && <Check className="size-3 text-primary shrink-0" />}
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
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((item) => {
            const ItemIcon = ENTITY_TYPE_ICON[item.type]
            return (
              <span
                key={`${item.type}:${item.id}`}
                className="inline-flex items-center gap-1 text-xs bg-accent rounded px-1.5 py-0.5"
              >
                <ItemIcon className="size-3 text-muted-foreground shrink-0" />
                <span className="truncate max-w-[120px]">{item.title}</span>
                <button
                  type="button"
                  className="hover:text-destructive"
                  onClick={() => onRemove(item)}
                >
                  <X className="size-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
import { Plus, Check, X } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import type { TagItem } from '@entities/tag'

interface Props {
  allTags: TagItem[]
  attachedTagIds: Set<string>
  onToggle: (tag: TagItem) => void
  onCreateClick: () => void
  onRemove?: (tag: TagItem) => void
}

export function TagPicker({
  allTags,
  attachedTagIds,
  onToggle,
  onCreateClick,
  onRemove
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return allTags
    const q = search.toLowerCase()
    return allTags.filter((t) => t.name.toLowerCase().includes(q))
  }, [allTags, search])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-6">
          <Plus className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <Input
          placeholder="태그 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-7 text-xs"
        />
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">태그가 없습니다</div>
          ) : (
            filtered.map((tag) => {
              const isAttached = attachedTagIds.has(tag.id)
              return (
                <div key={tag.id} className="group flex items-center rounded hover:bg-accent">
                  <button
                    type="button"
                    onClick={() => onToggle(tag)}
                    className="flex-1 flex items-center gap-2 text-xs px-2 py-1.5 text-left cursor-pointer min-w-0"
                  >
                    {isAttached ? (
                      <Check className="size-3 text-primary shrink-0" />
                    ) : (
                      <span className="size-3 shrink-0" />
                    )}
                    <span
                      className="size-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate flex-1">{tag.name}</span>
                  </button>
                  {onRemove && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemove(tag)
                      }}
                      className="shrink-0 p-1 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
        <div className="border-t mt-1 pt-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onCreateClick()
            }}
            className="w-full flex items-center gap-2 text-xs rounded px-2 py-1.5 text-left hover:bg-accent cursor-pointer text-muted-foreground"
          >
            <Plus className="size-3" />새 태그 만들기
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

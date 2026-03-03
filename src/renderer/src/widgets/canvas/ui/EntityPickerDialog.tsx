import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Input } from '@shared/ui/input'
import { Search } from 'lucide-react'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useTodosByWorkspace } from '@entities/todo'
import { useNotesByWorkspace } from '@entities/note'
import { useAllSchedulesByWorkspace } from '@entities/schedule'
import { useCsvFilesByWorkspace } from '@entities/csv-file'
import { usePdfFilesByWorkspace } from '@entities/pdf-file'
import { useImageFilesByWorkspace } from '@entities/image-file'
import type { CanvasNodeType } from '@entities/canvas'
import { PICKABLE_TYPES } from '../model/node-type-registry'

interface EntityOption {
  id: string
  title: string
  preview?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (type: CanvasNodeType, refId: string) => void
}

export function EntityPickerDialog({ open, onOpenChange, onSelect }: Props): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>요소 추가</DialogTitle>
        </DialogHeader>
        {open && workspaceId ? (
          <EntityPickerContent
            workspaceId={workspaceId}
            onSelect={onSelect}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function EntityPickerContent({
  workspaceId,
  onSelect,
  onOpenChange
}: {
  workspaceId: string
  onSelect: (type: CanvasNodeType, refId: string) => void
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const [selectedType, setSelectedType] = useState<CanvasNodeType>('todo')
  const [search, setSearch] = useState('')

  const { data: todos = [] } = useTodosByWorkspace(workspaceId)
  const { data: notes = [] } = useNotesByWorkspace(workspaceId)
  const { data: schedules = [] } = useAllSchedulesByWorkspace(workspaceId)
  const { data: csvFiles = [] } = useCsvFilesByWorkspace(workspaceId)
  const { data: pdfFiles = [] } = usePdfFilesByWorkspace(workspaceId)
  const { data: imageFiles = [] } = useImageFilesByWorkspace(workspaceId)

  const entityMap: Record<CanvasNodeType, EntityOption[]> = useMemo(
    () => ({
      text: [],
      todo: todos.map((t) => ({ id: t.id, title: t.title, preview: t.description })),
      note: notes.map((n) => ({ id: n.id, title: n.title, preview: n.preview })),
      schedule: schedules.map((s) => ({
        id: s.id,
        title: s.title,
        preview: s.description ?? s.location ?? undefined
      })),
      csv: csvFiles.map((c) => ({ id: c.id, title: c.title, preview: c.preview })),
      pdf: pdfFiles.map((p) => ({ id: p.id, title: p.title, preview: p.preview })),
      image: imageFiles.map((i) => ({ id: i.id, title: i.title, preview: i.description }))
    }),
    [todos, notes, schedules, csvFiles, pdfFiles, imageFiles]
  )

  const filtered = useMemo(() => {
    const items = entityMap[selectedType] ?? []
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(
      (item) => item.title.toLowerCase().includes(q) || item.preview?.toLowerCase().includes(q)
    )
  }, [entityMap, selectedType, search])

  const handleSelect = (item: EntityOption): void => {
    onSelect(selectedType, item.id)
    onOpenChange(false)
  }

  return (
    <>
      <div className="flex gap-1 flex-wrap">
        {PICKABLE_TYPES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => {
              setSelectedType(type)
              setSearch('')
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
              selectedType === type
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="검색..."
          className="pl-9"
        />
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1">
        {filtered.length === 0 && (
          <p className="text-center py-6 text-sm text-muted-foreground">항목이 없습니다</p>
        )}
        {filtered.map((item) => (
          <button
            key={item.id}
            onClick={() => handleSelect(item)}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
          >
            <p className="text-sm font-medium truncate">{item.title}</p>
            {item.preview && (
              <p className="text-xs text-muted-foreground truncate">{item.preview}</p>
            )}
          </button>
        ))}
      </div>
    </>
  )
}

import { JSX, useState, useRef, useEffect } from 'react'
import { Trash2 } from 'lucide-react'

interface Props {
  name: string
  colIndex: number
  onRename: (colIndex: number, name: string) => void
  onRemove: (colIndex: number) => void
}

export function EditableColumnHeader({ name, colIndex, onRename, onRemove }: Props): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(name)
  }, [name])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        size={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (draft !== name) onRename(colIndex, draft)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setEditing(false)
            if (draft !== name) onRename(colIndex, draft)
          }
          if (e.key === 'Escape') {
            setEditing(false)
            setDraft(name)
          }
        }}
        className="w-full px-2 py-1 text-sm font-medium bg-muted border-0 outline-none ring-1 ring-primary"
      />
    )
  }

  return (
    <div className="flex items-center gap-1 group/header">
      <span className="flex-1 truncate cursor-text" onDoubleClick={() => setEditing(true)}>
        {name}
      </span>
      <button
        className="opacity-0 group-hover/header:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-opacity"
        onClick={() => onRemove(colIndex)}
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  )
}

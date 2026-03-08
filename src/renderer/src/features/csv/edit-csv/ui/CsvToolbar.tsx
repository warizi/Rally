import { JSX, useRef, useEffect } from 'react'
import { Plus, Undo2, Redo2, ChevronUp, ChevronDown, Search, X } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Separator } from '@shared/ui/separator'

interface Props {
  rowCount: number
  colCount: number
  isDirty: boolean
  canUndo: boolean
  canRedo: boolean
  onAddRow: () => void
  onAddColumn: () => void
  onUndo: () => void
  onRedo: () => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  onSearchNext: () => void
  onSearchPrev: () => void
  searchMatchCount: number
  searchCurrentIndex: number
}

export function CsvToolbar({
  rowCount,
  colCount,
  isDirty,
  canUndo,
  canRedo,
  onAddRow,
  onAddColumn,
  onUndo,
  onRedo,
  searchQuery,
  onSearchQueryChange,
  onSearchNext,
  onSearchPrev,
  searchMatchCount,
  searchCurrentIndex
}: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  // Cmd/Ctrl+F to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-7" disabled={!canUndo} onClick={onUndo}>
          <Undo2 className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" disabled={!canRedo} onClick={onRedo}>
          <Redo2 className="size-3.5" />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAddRow}>
          <Plus className="size-3 mr-1" />행 추가
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAddColumn}>
          <Plus className="size-3 mr-1" />열 추가
        </Button>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <div className="flex items-center gap-0.5">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            className="no-drag-region h-6 w-36 rounded border bg-background px-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (e.shiftKey) onSearchPrev()
                else onSearchNext()
              }
              if (e.key === 'Escape') {
                onSearchQueryChange('')
                inputRef.current?.blur()
              }
            }}
          />
          {searchQuery && (
            <>
              <span className="text-xs text-muted-foreground tabular-nums min-w-[3ch] text-center">
                {searchMatchCount > 0 ? `${searchCurrentIndex + 1}/${searchMatchCount}` : '0'}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => {
                  onSearchQueryChange('')
                  inputRef.current?.focus()
                }}
              >
                <X className="size-3" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={searchMatchCount === 0}
            onClick={onSearchPrev}
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={searchMatchCount === 0}
            onClick={onSearchNext}
          >
            <ChevronDown className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {colCount}열 × {rowCount}행
        </span>
        {isDirty && <span className="text-amber-500">저장 중...</span>}
      </div>
    </div>
  )
}

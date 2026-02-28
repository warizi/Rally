import { JSX } from 'react'
import { Plus, Undo2, Redo2 } from 'lucide-react'
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
  onRedo
}: Props): JSX.Element {
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

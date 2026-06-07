import { JSX } from 'react'
import { Trash2 } from 'lucide-react'

interface Props {
  name: string
  colIndex: number
  onRemove: (colIndex: number) => void
  /** 더블클릭 → 편집 시작(실제 편집/입력은 active 헤더 셀 위 floating CsvCellEditor 가 담당). */
  onStartEdit: () => void
}

/**
 * 헤더 이름 표시 + 삭제 버튼(읽기 전용). 편집/입력은 floating CsvCellEditor 가 담당.
 */
export function EditableColumnHeader({
  name,
  colIndex,
  onRemove,
  onStartEdit
}: Props): JSX.Element {
  return (
    <div className="flex items-center gap-1 group/header">
      <span className="flex-1 truncate cursor-text" onDoubleClick={onStartEdit}>
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

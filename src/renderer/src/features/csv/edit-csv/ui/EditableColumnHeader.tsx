import { JSX, useState, useRef, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'

interface Props {
  name: string
  colIndex: number
  onRename: (colIndex: number, name: string) => void
  onRemove: (colIndex: number) => void
  /** 외부 제어: undefined 면 내부 state 유지 (하위 호환), 명시되면 controlled mode. */
  isEditing?: boolean
  /** 편집 종료 알림 (controlled mode 에서 사용). */
  onStopEdit?: () => void
  /** 편집 시작 요청 (double-click 등에서 호출 — controlled mode 일 때 부모가 처리). */
  onStartEdit?: () => void
  /** commit 직후 selection 을 dRow/dCol 만큼 이동. Tab/Shift+Tab/Shift+Enter 에서 사용. */
  onCommitAndMove?: (dRow: number, dCol: number) => void
}

export function EditableColumnHeader({
  name,
  colIndex,
  onRename,
  onRemove,
  isEditing: externalEditing,
  onStopEdit,
  onStartEdit,
  onCommitAndMove
}: Props): JSX.Element {
  const [internalEditing, setInternalEditing] = useState(false)
  const editing = externalEditing ?? internalEditing
  const isControlled = externalEditing !== undefined

  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)
  const didCommitRef = useRef(false)

  useEffect(() => {
    setDraft(name)
  }, [name])

  useEffect(() => {
    if (editing && inputRef.current) {
      didCommitRef.current = false
      inputRef.current.focus()
      // 바디 셀과 동일: 끝에 커서 위치 (전체 선택 X)
      inputRef.current.selectionStart = inputRef.current.value.length
    }
  }, [editing])

  const stopEditing = useCallback(() => {
    if (isControlled) onStopEdit?.()
    else setInternalEditing(false)
  }, [isControlled, onStopEdit])

  const commit = useCallback(() => {
    if (didCommitRef.current) return
    didCommitRef.current = true
    stopEditing()
    if (draft !== name) onRename(colIndex, draft)
  }, [draft, name, onRename, colIndex, stopEditing])

  const startEditing = useCallback(() => {
    if (isControlled) onStartEdit?.()
    else setInternalEditing(true)
  }, [isControlled, onStartEdit])

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-csv-edit-input
        size={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        // 부모 헤더 div 의 handleHeaderMouseDown 으로 mousedown 이 bubble 되면
        // setEditingCell(null) 이 호출되어 편집 모드 즉시 해제 + 텍스트 선택 불가.
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          // Tab: commit + 옆 헤더 셀 이동
          if (e.key === 'Tab') {
            e.preventDefault()
            commit()
            onCommitAndMove?.(0, e.shiftKey ? -1 : 1)
            return
          }
          if (e.key === 'Enter' && e.shiftKey) {
            // 헤더에서 Shift+Enter → commit + 첫 데이터 행으로 이동 (dRow = +1 from row=-1 → row=0)
            e.preventDefault()
            commit()
            onCommitAndMove?.(1, 0)
            return
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
            return
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            didCommitRef.current = true
            setDraft(name)
            stopEditing()
          }
        }}
        className="w-full text-sm font-medium bg-transparent border-0 outline-none p-0"
      />
    )
  }

  return (
    <div className="flex items-center gap-1 group/header">
      <span className="flex-1 truncate cursor-text" onDoubleClick={startEditing}>
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

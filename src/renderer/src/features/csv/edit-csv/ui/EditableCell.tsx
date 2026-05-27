import { JSX, useState, useCallback, useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  isEditing: boolean
  onStopEdit: () => void
  /** commit \uC9C1\uD6C4 selection \uC744 dRow/dCol \uB9CC\uD07C \uC774\uB3D9. Tab/Shift+Tab \uB4F1\uC5D0\uC11C \uC0AC\uC6A9. */
  onCommitAndMove?: (dRow: number, dCol: number) => void
}

export function EditableCell({
  value,
  onChange,
  isEditing,
  onStopEdit,
  onCommitAndMove
}: Props): JSX.Element {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const didCommitRef = useRef(false)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      didCommitRef.current = false
      inputRef.current.focus()
      inputRef.current.selectionStart = inputRef.current.value.length
    }
  }, [isEditing])

  const commit = useCallback(() => {
    if (didCommitRef.current) return
    didCommitRef.current = true
    onStopEdit()
    if (draft !== value) onChange(draft)
  }, [draft, value, onChange, onStopEdit])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        data-csv-edit-input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        // mousedown \uC774 \uBD80\uBAA8 cell div \uC758 handleCellMouseDown \uC73C\uB85C bubble \uB418\uBA74
        // setEditingCell(null) \uC774 \uD638\uCD9C\uB418\uC5B4 \uD3B8\uC9D1 \uBAA8\uB4DC \uC989\uC2DC \uD574\uC81C + \uD14D\uC2A4\uD2B8 \uC120\uD0DD \uBD88\uAC00.
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          // Tab: commit + \uC606 \uC140 \uC774\uB3D9 (Shift+Tab = \uC774\uC804, Tab = \uB2E4\uC74C)
          if (e.key === 'Tab') {
            e.preventDefault()
            commit()
            onCommitAndMove?.(0, e.shiftKey ? -1 : 1)
            return
          }
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault()
            const el = e.currentTarget
            const pos = el.selectionStart ?? draft.length
            setDraft(draft.slice(0, pos) + '\n' + draft.slice(pos))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            didCommitRef.current = true
            setDraft(value)
            onStopEdit()
          }
        }}
        className="w-full h-full px-2 py-1 text-sm bg-transparent border-0 outline-none"
      />
    )
  }

  return (
    <div className="px-2 py-1 text-sm truncate cursor-text min-h-[28px] h-full">
      {value || '\u00A0'}
    </div>
  )
}

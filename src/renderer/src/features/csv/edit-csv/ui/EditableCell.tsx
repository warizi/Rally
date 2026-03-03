import { JSX, useState, useCallback, useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  isEditing: boolean
  onStopEdit: () => void
}

export function EditableCell({ value, onChange, isEditing, onStopEdit }: Props): JSX.Element {
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
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation()
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

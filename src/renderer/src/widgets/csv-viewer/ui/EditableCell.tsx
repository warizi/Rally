import { JSX, useState, useCallback, useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  isEditing: boolean
  onStopEdit: () => void
}

function autoResize(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export function EditableCell({ value, onChange, isEditing, onStopEdit }: Props): JSX.Element {
  const [draft, setDraft] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const didCommitRef = useRef(false)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (isEditing) {
      didCommitRef.current = false
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.selectionStart = textareaRef.current.value.length
        autoResize(textareaRef.current)
      }
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
      <textarea
        ref={textareaRef}
        rows={1}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          autoResize(e.target)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            didCommitRef.current = true
            setDraft(value)
            onStopEdit()
          }
        }}
        className="w-full px-2 py-1 text-sm bg-transparent border-0 outline-none resize-none"
      />
    )
  }

  return (
    <div className="px-2 py-1 text-sm whitespace-pre-wrap break-all cursor-text min-h-[28px] h-full">
      {value || '\u00A0'}
    </div>
  )
}

import { useCallback } from 'react'
import type { CellPos, Selection, SelectionRange } from './types'
import type { UseCsvClipboardReturn } from './use-csv-clipboard'

export interface UseCsvKeyboardReturn {
  handleKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
}

export function useCsvKeyboard(
  selection: Selection | null,
  selectionRange: SelectionRange | null,
  isSingleSelection: boolean,
  editingCell: CellPos | null,
  setSelection: React.Dispatch<React.SetStateAction<Selection | null>>,
  setEditingCell: React.Dispatch<React.SetStateAction<CellPos | null>>,
  clipboard: UseCsvClipboardReturn,
  dataLength: number,
  headersLength: number,
  onUndo: () => void,
  onRedo: () => void
): UseCsvKeyboardReturn {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!selection || editingCell) return

      const mod = e.metaKey || e.ctrlKey
      const { row, col } = selection.focus

      // Copy / Cut
      if (mod && (e.key === 'c' || e.key === 'x') && selectionRange) {
        e.preventDefault()
        clipboard.copy()
        if (e.key === 'x') clipboard.deleteSelection()
        return
      }

      // Undo
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        onUndo()
        return
      }

      // Redo
      if (mod && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault()
        onRedo()
        return
      }

      // Paste
      if (mod && e.key === 'v') {
        e.preventDefault()
        clipboard.paste()
        return
      }

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault()
          const newRow = Math.max(0, row - 1)
          if (e.shiftKey) {
            setSelection((prev) =>
              prev ? { anchor: prev.anchor, focus: { row: newRow, col } } : null
            )
          } else {
            setSelection({ anchor: { row: newRow, col }, focus: { row: newRow, col } })
          }
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          const newRow = Math.min(dataLength - 1, row + 1)
          if (e.shiftKey) {
            setSelection((prev) =>
              prev ? { anchor: prev.anchor, focus: { row: newRow, col } } : null
            )
          } else {
            setSelection({ anchor: { row: newRow, col }, focus: { row: newRow, col } })
          }
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          const newCol = Math.max(0, col - 1)
          if (e.shiftKey) {
            setSelection((prev) =>
              prev ? { anchor: prev.anchor, focus: { row, col: newCol } } : null
            )
          } else {
            setSelection({ anchor: { row, col: newCol }, focus: { row, col: newCol } })
          }
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          const newCol = Math.min(headersLength - 1, col + 1)
          if (e.shiftKey) {
            setSelection((prev) =>
              prev ? { anchor: prev.anchor, focus: { row, col: newCol } } : null
            )
          } else {
            setSelection({ anchor: { row, col: newCol }, focus: { row, col: newCol } })
          }
          break
        }
        case 'Enter':
          e.preventDefault()
          if (isSingleSelection) setEditingCell({ row, col })
          break
        case 'Escape':
          e.preventDefault()
          setSelection(null)
          break
        case 'Backspace':
        case 'Delete': {
          e.preventDefault()
          clipboard.deleteSelection()
          break
        }
        case 'Tab': {
          e.preventDefault()
          if (e.shiftKey) {
            if (col > 0) {
              setSelection({ anchor: { row, col: col - 1 }, focus: { row, col: col - 1 } })
            } else if (row > 0) {
              const p: CellPos = { row: row - 1, col: headersLength - 1 }
              setSelection({ anchor: p, focus: p })
            }
          } else {
            if (col < headersLength - 1) {
              setSelection({ anchor: { row, col: col + 1 }, focus: { row, col: col + 1 } })
            } else if (row < dataLength - 1) {
              const p: CellPos = { row: row + 1, col: 0 }
              setSelection({ anchor: p, focus: p })
            }
          }
          break
        }
      }
    },
    [
      selection,
      editingCell,
      selectionRange,
      isSingleSelection,
      clipboard,
      dataLength,
      headersLength,
      setSelection,
      setEditingCell,
      onUndo,
      onRedo
    ]
  )

  return { handleKeyDown }
}

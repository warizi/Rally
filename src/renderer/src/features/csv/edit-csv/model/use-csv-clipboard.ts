import { useCallback } from 'react'
import type { Selection, SelectionRange } from './types'

export interface UseCsvClipboardReturn {
  copy: () => void
  cut: () => void
  paste: () => void
  deleteSelection: () => void
}

export function useCsvClipboard(
  selection: Selection | null,
  selectionRange: SelectionRange | null,
  data: string[][],
  headers: string[],
  onUpdateCells: (changes: { row: number; col: number; value: string }[]) => void
): UseCsvClipboardReturn {
  const copy = useCallback(() => {
    if (!selectionRange) return
    const lines: string[] = []
    for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
      const cells: string[] = []
      for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
        cells.push(data[r]?.[c] ?? '')
      }
      lines.push(cells.join('\t'))
    }
    navigator.clipboard.writeText(lines.join('\n'))
  }, [selectionRange, data])

  const deleteSelection = useCallback(() => {
    if (!selectionRange) return
    const changes: { row: number; col: number; value: string }[] = []
    for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
      for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
        changes.push({ row: r, col: c, value: '' })
      }
    }
    if (changes.length > 0) onUpdateCells(changes)
  }, [selectionRange, onUpdateCells])

  const cut = useCallback(() => {
    copy()
    deleteSelection()
  }, [copy, deleteSelection])

  const paste = useCallback(() => {
    if (!selection) return
    const { row, col } = selection.focus
    navigator.clipboard.readText().then((text) => {
      if (!text) return
      const rows = text.split('\n').map((line) => line.split('\t'))
      const changes: { row: number; col: number; value: string }[] = []
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          const targetRow = row + r
          const targetCol = col + c
          if (targetRow < data.length && targetCol < headers.length) {
            changes.push({ row: targetRow, col: targetCol, value: rows[r][c] })
          }
        }
      }
      if (changes.length > 0) onUpdateCells(changes)
    })
  }, [selection, data.length, headers.length, onUpdateCells])

  return { copy, cut, paste, deleteSelection }
}

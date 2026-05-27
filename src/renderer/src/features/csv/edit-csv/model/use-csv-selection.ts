import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { Virtualizer } from '@tanstack/react-virtual'
import type { CellPos, Selection, SelectionRange } from './types'

export interface UseCsvSelectionReturn {
  selection: Selection | null
  selectionRange: SelectionRange | null
  isSingleSelection: boolean
  editingCell: CellPos | null
  contextMenuOpenRef: React.MutableRefObject<boolean>
  handleCellMouseDown: (row: number, col: number, e: React.MouseEvent) => void
  handleCellMouseEnter: (row: number, col: number) => void
  handleMouseUp: () => void
  handleCellStartEdit: (row: number, col: number) => void
  handleStopEdit: () => void
  handleBlur: (e: React.FocusEvent<HTMLDivElement>) => void
  setSelection: React.Dispatch<React.SetStateAction<Selection | null>>
  setEditingCell: React.Dispatch<React.SetStateAction<CellPos | null>>
}

export function useCsvSelection(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>,
  colVirtualizer: Virtualizer<HTMLDivElement, Element>
): UseCsvSelectionReturn {
  const [selection, setSelection] = useState<Selection | null>(null)
  const [editingCell, setEditingCell] = useState<CellPos | null>(null)
  const isDragging = useRef(false)
  const contextMenuOpenRef = useRef(false)

  // --- Selection range ---
  const selectionRange = useMemo<SelectionRange | null>(() => {
    if (!selection) return null
    return {
      startRow: Math.min(selection.anchor.row, selection.focus.row),
      endRow: Math.max(selection.anchor.row, selection.focus.row),
      startCol: Math.min(selection.anchor.col, selection.focus.col),
      endCol: Math.max(selection.anchor.col, selection.focus.col)
    }
  }, [selection])

  const isSingleSelection =
    !!selection &&
    selection.anchor.row === selection.focus.row &&
    selection.anchor.col === selection.focus.col

  // --- Scroll to focused cell ---
  useEffect(() => {
    if (!selection) return
    // row = -1 (헤더) 는 항상 보이므로 scroll 불필요
    if (selection.focus.row >= 0) {
      rowVirtualizer.scrollToIndex(selection.focus.row, { align: 'auto' })
    }
    colVirtualizer.scrollToIndex(selection.focus.col, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.focus.row, selection?.focus.col])

  // --- Mouse handlers ---
  const handleCellMouseDown = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      if (e.button !== 0) return
      if (e.shiftKey && selection) {
        setSelection((prev) =>
          prev
            ? { anchor: prev.anchor, focus: { row, col } }
            : { anchor: { row, col }, focus: { row, col } }
        )
      } else {
        setSelection({ anchor: { row, col }, focus: { row, col } })
      }
      isDragging.current = true
      setEditingCell(null)
      scrollRef.current?.focus()
    },
    [selection, scrollRef]
  )

  const handleCellMouseEnter = useCallback((row: number, col: number) => {
    if (!isDragging.current) return
    setSelection((prev) => (prev ? { anchor: prev.anchor, focus: { row, col } } : null))
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const handleCellStartEdit = useCallback((row: number, col: number) => {
    setSelection({ anchor: { row, col }, focus: { row, col } })
    setEditingCell({ row, col })
  }, [])

  const handleStopEdit = useCallback(() => {
    setEditingCell(null)
  }, [])

  // --- Focus back to grid after edit ---
  const wasEditingRef = useRef(false)
  useEffect(() => {
    if (wasEditingRef.current && !editingCell) {
      scrollRef.current?.focus()
    }
    wasEditingRef.current = editingCell !== null
  }, [editingCell, scrollRef])

  // --- Blur ---
  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget)) return
    if (contextMenuOpenRef.current) return
    // 헤더 편집 input 은 scrollRef 외부에 위치 — focus 이동이 외부 클릭으로 오인되지
    // 않도록 data-csv-edit-input 마커가 있는 element 로의 이동은 cleanup 보류.
    // (input 의 onBlur 가 편집 종료를 자체 처리)
    const target = e.relatedTarget as HTMLElement | null
    if (target?.matches?.('[data-csv-edit-input]')) return
    setSelection(null)
    setEditingCell(null)
  }, [])

  return {
    selection,
    selectionRange,
    isSingleSelection,
    editingCell,
    contextMenuOpenRef,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleMouseUp,
    handleCellStartEdit,
    handleStopEdit,
    handleBlur,
    setSelection,
    setEditingCell
  }
}

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { Virtualizer } from '@tanstack/react-virtual'
import type { CellPos, Selection, SelectionRange } from './types'

export interface UseCsvSelectionReturn {
  selection: Selection | null
  selectionRange: SelectionRange | null
  isSingleSelection: boolean
  editingCell: CellPos | null
  /** 편집 진입 시 draft 초기값. null = 기존값 유지(F2/더블클릭), 문자 = 교체(type-to-edit). */
  editSeed: string | null
  /** 범위 선택 중 Tab/Enter 로 순환하는 active 셀(범위는 selection 유지). null = selection.focus 사용. */
  lockedActive: CellPos | null
  setLockedActive: React.Dispatch<React.SetStateAction<CellPos | null>>
  contextMenuOpenRef: React.MutableRefObject<boolean>
  handleCellMouseDown: (row: number, col: number, e: React.MouseEvent) => void
  handleCellMouseEnter: (row: number, col: number) => void
  handleMouseUp: () => void
  handleCellStartEdit: (row: number, col: number) => void
  /** 편집 진입(seed=null 기존값 유지 / 문자 교체). */
  beginEdit: (row: number, col: number, seed?: string | null) => void
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
  const [editSeed, setEditSeed] = useState<string | null>(null)
  const [lockedActive, setLockedActive] = useState<CellPos | null>(null)
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

  // --- Scroll to active(focus 또는 lockedActive) cell ---
  const active = lockedActive ?? selection?.focus ?? null
  useEffect(() => {
    if (!active) return
    // row = -1 (헤더) 는 항상 보이므로 scroll 불필요
    if (active.row >= 0) {
      rowVirtualizer.scrollToIndex(active.row, { align: 'auto' })
    }
    colVirtualizer.scrollToIndex(active.col, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.row, active?.col])

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
      setEditSeed(null)
      setLockedActive(null)
      // scrollRef 로 포커스를 강제하지 않는다 — body 단일 셀은 floating CsvCellEditor 가 스스로 focus.
      // (여기서 scrollRef 를 focus 하면 이미 active 한 셀 재클릭 시 에디터 포커스를 뺏어 한글 IME 가 깨진다.)
      // 헤더는 handleHeaderMouseDown, 범위/드래그는 CsvTable focus 효과 + handleBlur 가 grid 로 회수.
    },
    [selection]
  )

  const handleCellMouseEnter = useCallback((row: number, col: number) => {
    if (!isDragging.current) return
    setSelection((prev) => (prev ? { anchor: prev.anchor, focus: { row, col } } : null))
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // 편집 진입 공통 진입점. seed=null → 기존값 유지(F2/더블클릭), seed=문자 → 교체(type-to-edit).
  const beginEdit = useCallback((row: number, col: number, seed: string | null = null) => {
    setSelection({ anchor: { row, col }, focus: { row, col } })
    setLockedActive(null)
    setEditSeed(seed)
    setEditingCell({ row, col })
  }, [])

  const handleCellStartEdit = useCallback(
    (row: number, col: number) => {
      beginEdit(row, col, null)
    },
    [beginEdit]
  )

  const handleStopEdit = useCallback(() => {
    setEditingCell(null)
    setEditSeed(null)
  }, [])

  // 편집 종료 후 포커스 회수는 floating CsvCellEditor(자기 focus) + CsvTable 의 focus 효과(헤더/범위)가 담당.
  // 여기서 scrollRef 로 회수하면 body 셀의 floating editor 포커스를 뺏어 한글 IME 가 깨진다.

  // --- Blur ---
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (e.currentTarget.contains(e.relatedTarget)) return
      if (contextMenuOpenRef.current) return
      // 헤더 편집 input 은 scrollRef 외부에 위치 — focus 이동이 외부 클릭으로 오인되지
      // 않도록 data-csv-edit-input 마커가 있는 element 로의 이동은 cleanup 보류.
      // (input 의 onBlur 가 편집 종료를 자체 처리)
      const target = e.relatedTarget as HTMLElement | null
      if (target?.matches?.('[data-csv-edit-input]')) return
      if (target == null) {
        // 포커스가 아무 데도 안 감 → floating editor unmount(body→헤더/범위 전환) 등 일시 이탈.
        // 선택을 유지하고 grid 로 포커스 회수 (진짜 외부 클릭은 다른 focusable 로 relatedTarget 이 잡힘).
        scrollRef.current?.focus()
        return
      }
      setSelection(null)
      setEditingCell(null)
      setEditSeed(null)
      setLockedActive(null)
    },
    [scrollRef]
  )

  return {
    selection,
    selectionRange,
    isSingleSelection,
    editingCell,
    editSeed,
    lockedActive,
    setLockedActive,
    contextMenuOpenRef,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleMouseUp,
    handleCellStartEdit,
    beginEdit,
    handleStopEdit,
    handleBlur,
    setSelection,
    setEditingCell
  }
}

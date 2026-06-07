import { useCallback } from 'react'
import type { CellPos, Selection, SelectionRange } from './types'
import type { UseCsvClipboardReturn } from './use-csv-clipboard'
import { nextInRange, computeEnterMove } from './nav'

export interface UseCsvKeyboardReturn {
  handleKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
}

export function useCsvKeyboard(
  selection: Selection | null,
  selectionRange: SelectionRange | null,
  isSingleSelection: boolean,
  editingCell: CellPos | null,
  setSelection: React.Dispatch<React.SetStateAction<Selection | null>>,
  beginEdit: (row: number, col: number, seed?: string | null) => void,
  clipboard: UseCsvClipboardReturn,
  dataLength: number,
  headersLength: number,
  lockedActive: CellPos | null,
  setLockedActive: React.Dispatch<React.SetStateAction<CellPos | null>>,
  tabStartColRef: React.MutableRefObject<number | null>,
  onUndo: () => void,
  onRedo: () => void
): UseCsvKeyboardReturn {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!selection || editingCell) return

      const mod = e.metaKey || e.ctrlKey
      const { row, col } = selection.focus
      // 헤더 행(row = -1)은 데이터가 아니므로 clipboard / delete 류 차단
      const isHeader = row === -1

      // Copy / Cut
      if (mod && (e.key === 'c' || e.key === 'x') && selectionRange && !isHeader) {
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

      // Paste (헤더에서는 차단)
      if (mod && e.key === 'v' && !isHeader) {
        e.preventDefault()
        clipboard.paste()
        return
      }

      // Type-to-edit: 단일 선택 + printable 문자 → 즉시 편집 진입 + 기존값 교체.
      // body 셀은 floating CsvCellEditor 가 focus 를 가지고 printable 을 직접 처리(stopPropagation)하므로
      // 이 경로는 사실상 헤더(scrollRef focus) + fallback 용. 한글 IME 는 각 input 에서 직접 조합된다.
      if (!mod && !e.altKey && e.key.length === 1 && isSingleSelection) {
        e.preventDefault()
        beginEdit(row, col, e.key)
        return
      }

      // F2: 내용 유지 편집 진입 (type-to-edit 의 교체와 구분)
      if (e.key === 'F2') {
        e.preventDefault()
        if (isSingleSelection) beginEdit(row, col, null)
        return
      }

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault()
          tabStartColRef.current = null
          setLockedActive(null)
          // row = -1 → 헤더. 더 위로는 못 감.
          const newRow = Math.max(-1, row - 1)
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
          tabStartColRef.current = null
          setLockedActive(null)
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
          tabStartColRef.current = null
          setLockedActive(null)
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
          tabStartColRef.current = null
          setLockedActive(null)
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
        case 'Enter': {
          e.preventDefault()
          // 범위 선택 → 편집 없이 범위 내 순환(열 우선). Shift = 역방향.
          if (!isSingleSelection && selectionRange) {
            const base = lockedActive ?? selection.focus
            setLockedActive(nextInRange(base, selectionRange, e.shiftKey ? -1 : 1, 'col'))
            break
          }
          // 단일 선택(비편집) → 아래 셀로 이동 (엑셀식, 편집 진입 X). Tab→Enter 복귀 적용.
          const target = computeEnterMove(selection.focus, tabStartColRef.current)
          const newRow = Math.max(-1, Math.min(dataLength - 1, target.row))
          const newCol = Math.max(0, Math.min(headersLength - 1, target.col))
          setSelection({
            anchor: { row: newRow, col: newCol },
            focus: { row: newRow, col: newCol }
          })
          break
        }
        case 'Escape':
          e.preventDefault()
          tabStartColRef.current = null
          setLockedActive(null)
          setSelection(null)
          break
        case 'Backspace':
        case 'Delete': {
          e.preventDefault()
          // 헤더 행에서는 Delete 무시 (헤더 이름 비우려면 편집 진입 후 처리)
          if (!isHeader) clipboard.deleteSelection()
          break
        }
        case 'Tab': {
          e.preventDefault()
          // 범위 선택 → 범위 내 순환(행 우선). Shift = 역방향.
          if (!isSingleSelection && selectionRange) {
            const base = lockedActive ?? selection.focus
            setLockedActive(nextInRange(base, selectionRange, e.shiftKey ? -1 : 1, 'row'))
            break
          }
          if (e.shiftKey) {
            if (col > 0) {
              setSelection({ anchor: { row, col: col - 1 }, focus: { row, col: col - 1 } })
            } else if (row > -1) {
              // row=0 에서 Shift+Tab → 헤더 마지막 열로
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
      beginEdit,
      clipboard,
      dataLength,
      headersLength,
      lockedActive,
      setLockedActive,
      tabStartColRef,
      setSelection,
      onUndo,
      onRedo
    ]
  )

  return { handleKeyDown }
}

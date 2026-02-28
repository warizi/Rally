/* eslint-disable prettier/prettier */
import { JSX, useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ColumnSizingState, Updater } from '@tanstack/react-table'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@shared/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@shared/ui/context-menu'
import { EditableCell } from './EditableCell'
import { EditableColumnHeader } from './EditableColumnHeader'

type CellPos = { row: number; col: number }

const ROW_HEIGHT = 28
const HEADER_HEIGHT = 32
const ROW_NUM_WIDTH = 50
const ADD_COL_WIDTH = 40
const DEFAULT_COL_WIDTH = 150
const MIN_COL_WIDTH = 60

interface Props {
  headers: string[]
  data: string[][]
  columnSizing: ColumnSizingState
  onColumnSizingChange: (updater: Updater<ColumnSizingState>) => void
  onUpdateCell: (rowIndex: number, colIndex: number, value: string) => void
  onUpdateCells: (changes: { row: number; col: number; value: string }[]) => void
  onRemoveRow: (rowIndex: number) => void
  onAddRowAt: (index: number) => void
  onAddColumn: (name?: string) => void
  onAddColumnAt: (index: number, name?: string) => void
  onRemoveColumn: (colIndex: number) => void
  onRenameColumn: (colIndex: number, name: string) => void
  onUndo: () => void
  onRedo: () => void
}

export function CsvTable({
  headers,
  data,
  columnSizing,
  onColumnSizingChange,
  onUpdateCell,
  onUpdateCells,
  onRemoveRow,
  onAddRowAt,
  onAddColumn,
  onAddColumnAt,
  onRemoveColumn,
  onRenameColumn,
  onUndo,
  onRedo
}: Props): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const rowNumRef = useRef<HTMLDivElement>(null)

  const [selection, setSelection] = useState<{ anchor: CellPos; focus: CellPos } | null>(null)
  const [editingCell, setEditingCell] = useState<CellPos | null>(null)
  const isDragging = useRef(false)
  const contextMenuOpenRef = useRef(false)

  // --- Column width ---
  const getColWidth = useCallback(
    (index: number) => columnSizing[`col_${index}`] ?? DEFAULT_COL_WIDTH,
    [columnSizing]
  )

  // --- Virtualizers ---
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15
  })

  const colVirtualizer = useVirtualizer({
    horizontal: true,
    count: headers.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: getColWidth,
    overscan: 5
  })

  // --- Scroll sync ---
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = (): void => {
      if (headerRef.current) headerRef.current.scrollLeft = el.scrollLeft
      if (rowNumRef.current) rowNumRef.current.scrollTop = el.scrollTop
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // --- Scroll to focused cell ---
  useEffect(() => {
    if (!selection) return
    rowVirtualizer.scrollToIndex(selection.focus.row, { align: 'auto' })
    colVirtualizer.scrollToIndex(selection.focus.col, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.focus.row, selection?.focus.col])

  // --- Selection ---
  const selectionRange = useMemo(() => {
    if (!selection) return null
    return {
      startRow: Math.min(selection.anchor.row, selection.focus.row),
      endRow: Math.max(selection.anchor.row, selection.focus.row),
      startCol: Math.min(selection.anchor.col, selection.focus.col),
      endCol: Math.max(selection.anchor.col, selection.focus.col)
    }
  }, [selection])

  const isSingleSelection =
    selection &&
    selection.anchor.row === selection.focus.row &&
    selection.anchor.col === selection.focus.col

  // --- Mouse handlers ---
  const handleCellMouseDown = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      if (e.button !== 0) return
      if (e.shiftKey && selection) {
        setSelection((prev) =>
          prev ? { anchor: prev.anchor, focus: { row, col } } : { anchor: { row, col }, focus: { row, col } }
        )
      } else {
        setSelection({ anchor: { row, col }, focus: { row, col } })
      }
      isDragging.current = true
      setEditingCell(null)
      scrollRef.current?.focus()
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

  const handleCellStartEdit = useCallback((row: number, col: number) => {
    setSelection({ anchor: { row, col }, focus: { row, col } })
    setEditingCell({ row, col })
  }, [])

  const handleStopEdit = useCallback(() => {
    setEditingCell(null)
  }, [])

  // Focus back to grid after edit
  const wasEditingRef = useRef(false)
  useEffect(() => {
    if (wasEditingRef.current && !editingCell) {
      scrollRef.current?.focus()
    }
    wasEditingRef.current = editingCell !== null
  }, [editingCell])

  // --- Context menu actions ---
  const handleContextCopy = useCallback(() => {
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

  const handleContextCut = useCallback(() => {
    handleContextCopy()
    if (!selectionRange) return
    const changes: { row: number; col: number; value: string }[] = []
    for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
      for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
        changes.push({ row: r, col: c, value: '' })
      }
    }
    if (changes.length > 0) onUpdateCells(changes)
  }, [handleContextCopy, selectionRange, onUpdateCells])

  const handleContextDelete = useCallback(() => {
    if (!selectionRange) return
    const changes: { row: number; col: number; value: string }[] = []
    for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
      for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
        changes.push({ row: r, col: c, value: '' })
      }
    }
    if (changes.length > 0) onUpdateCells(changes)
  }, [selectionRange, onUpdateCells])

  const handleContextPaste = useCallback(() => {
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

  // --- Keyboard ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!selection || editingCell) return

      const mod = e.metaKey || e.ctrlKey
      const { row, col } = selection.focus

      // Copy / Cut
      if (mod && (e.key === 'c' || e.key === 'x') && selectionRange) {
        e.preventDefault()
        const lines: string[] = []
        for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
          const cells: string[] = []
          for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
            cells.push(data[r]?.[c] ?? '')
          }
          lines.push(cells.join('\t'))
        }
        navigator.clipboard.writeText(lines.join('\n'))
        if (e.key === 'x') {
          const changes: { row: number; col: number; value: string }[] = []
          for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
            for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
              changes.push({ row: r, col: c, value: '' })
            }
          }
          if (changes.length > 0) onUpdateCells(changes)
        }
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
        return
      }

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault()
          const newRow = Math.max(0, row - 1)
          if (e.shiftKey) {
            setSelection((prev) => (prev ? { anchor: prev.anchor, focus: { row: newRow, col } } : null))
          } else {
            setSelection({ anchor: { row: newRow, col }, focus: { row: newRow, col } })
          }
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          const newRow = Math.min(data.length - 1, row + 1)
          if (e.shiftKey) {
            setSelection((prev) => (prev ? { anchor: prev.anchor, focus: { row: newRow, col } } : null))
          } else {
            setSelection({ anchor: { row: newRow, col }, focus: { row: newRow, col } })
          }
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          const newCol = Math.max(0, col - 1)
          if (e.shiftKey) {
            setSelection((prev) => (prev ? { anchor: prev.anchor, focus: { row, col: newCol } } : null))
          } else {
            setSelection({ anchor: { row, col: newCol }, focus: { row, col: newCol } })
          }
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          const newCol = Math.min(headers.length - 1, col + 1)
          if (e.shiftKey) {
            setSelection((prev) => (prev ? { anchor: prev.anchor, focus: { row, col: newCol } } : null))
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
          if (!selectionRange) break
          const changes: { row: number; col: number; value: string }[] = []
          for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
            for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
              changes.push({ row: r, col: c, value: '' })
            }
          }
          if (changes.length > 0) onUpdateCells(changes)
          break
        }
        case 'Tab': {
          e.preventDefault()
          if (e.shiftKey) {
            if (col > 0) {
              setSelection({ anchor: { row, col: col - 1 }, focus: { row, col: col - 1 } })
            } else if (row > 0) {
              const p: CellPos = { row: row - 1, col: headers.length - 1 }
              setSelection({ anchor: p, focus: p })
            }
          } else {
            if (col < headers.length - 1) {
              setSelection({ anchor: { row, col: col + 1 }, focus: { row, col: col + 1 } })
            } else if (row < data.length - 1) {
              const p: CellPos = { row: row + 1, col: 0 }
              setSelection({ anchor: p, focus: p })
            }
          }
          break
        }
      }
    },
    [selection, editingCell, data, headers.length, isSingleSelection, selectionRange, onUpdateCells, onUndo, onRedo]
  )

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget)) return
    if (contextMenuOpenRef.current) return
    setSelection(null)
    setEditingCell(null)
  }, [])

  // --- Column resize ---
  const handleResizeStart = useCallback(
    (colIndex: number, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startWidth = getColWidth(colIndex)

      const onMouseMove = (ev: MouseEvent): void => {
        const diff = ev.clientX - startX
        const newWidth = Math.max(MIN_COL_WIDTH, startWidth + diff)
        onColumnSizingChange((prev) => ({ ...prev, [`col_${colIndex}`]: newWidth }))
      }

      const onMouseUp = (): void => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [getColWidth, onColumnSizingChange]
  )

  // --- Computed ---
  const colTotalSize = colVirtualizer.getTotalSize()
  const rowTotalSize = rowVirtualizer.getTotalSize()
  const virtualRows = rowVirtualizer.getVirtualItems()
  const virtualCols = colVirtualizer.getVirtualItems()

  // --- Empty state ---
  if (headers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-sm">빈 테이블입니다.</p>
        <Button variant="outline" size="sm" onClick={() => onAddColumn()}>
          <Plus className="size-4 mr-1" />열 추가
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex shrink-0 bg-muted border-b" style={{ height: HEADER_HEIGHT }}>
        {/* Corner */}
        <div
          className="shrink-0 flex items-center justify-center border-r text-xs text-muted-foreground"
          style={{ width: ROW_NUM_WIDTH }}
        >
          #
        </div>
        {/* Scrollable column headers */}
        <div ref={headerRef} className="flex-1 overflow-hidden">
          <div style={{ width: colTotalSize + ADD_COL_WIDTH, height: HEADER_HEIGHT, position: 'relative' }}>
            {virtualCols.map((vc) => {
              const ci = vc.index
              return (
                <div
                  key={`h_${ci}`}
                  className="absolute top-0 flex items-center px-2 text-sm font-medium border-r hover:bg-muted-foreground/10"
                  style={{ left: vc.start, width: vc.size, height: HEADER_HEIGHT }}
                >
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div className="flex-1 min-w-0">
                        <EditableColumnHeader
                          name={headers[ci]}
                          colIndex={ci}
                          onRename={onRenameColumn}
                          onRemove={onRemoveColumn}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-44">
                      <ContextMenuItem onClick={() => onAddColumnAt(ci)}>왼쪽에 열 추가</ContextMenuItem>
                      <ContextMenuItem onClick={() => onAddColumnAt(ci + 1)}>
                        오른쪽에 열 추가
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem variant="destructive" onClick={() => onRemoveColumn(ci)}>
                        열 삭제
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                    onMouseDown={(e) => handleResizeStart(ci, e)}
                  />
                </div>
              )
            })}
            {/* Add column button */}
            <div
              className="absolute top-0 flex items-center justify-center"
              style={{ left: colTotalSize, width: ADD_COL_WIDTH, height: HEADER_HEIGHT }}
            >
              <button className="p-1 text-muted-foreground hover:text-foreground" onClick={() => onAddColumn()}>
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* Row numbers */}
        <div
          ref={rowNumRef}
          className="shrink-0 overflow-hidden border-r bg-muted/30"
          style={{ width: ROW_NUM_WIDTH }}
        >
          <div style={{ height: rowTotalSize, position: 'relative' }}>
            {virtualRows.map((vr) => (
              <div
                key={`rn_${vr.index}`}
                className="absolute flex items-center justify-center text-xs text-muted-foreground border-b group"
                style={{ top: vr.start, height: vr.size, width: ROW_NUM_WIDTH }}
              >
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div className="flex items-center justify-center w-full h-full">
                      <span className="group-hover:hidden">{vr.index + 1}</span>
                      <button
                        className="hidden group-hover:block p-0.5 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveRow(vr.index)}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-44">
                    <ContextMenuItem onClick={() => onAddRowAt(vr.index)}>위에 행 추가</ContextMenuItem>
                    <ContextMenuItem onClick={() => onAddRowAt(vr.index + 1)}>
                      아래에 행 추가
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem variant="destructive" onClick={() => onRemoveRow(vr.index)}>
                      행 삭제
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </div>
            ))}
          </div>
        </div>

        {/* Data grid */}
        <ContextMenu onOpenChange={(open) => { contextMenuOpenRef.current = open }}>
          <ContextMenuTrigger asChild>
            <div
              ref={scrollRef}
              className="flex-1 overflow-auto outline-none select-none"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onMouseUp={handleMouseUp}
            >
              <div style={{ width: colTotalSize + ADD_COL_WIDTH, height: rowTotalSize, position: 'relative' }}>
                {virtualRows.flatMap((vr) =>
                  virtualCols.map((vc) => {
                    const ri = vr.index
                    const ci = vc.index
                    const isEditing = editingCell?.row === ri && editingCell?.col === ci
                    const isFocus = selection?.focus.row === ri && selection?.focus.col === ci
                    const isSelected =
                      selectionRange != null &&
                      ri >= selectionRange.startRow &&
                      ri <= selectionRange.endRow &&
                      ci >= selectionRange.startCol &&
                      ci <= selectionRange.endCol

                    return (
                      <div
                        key={`${ri}_${ci}`}
                        className={
                          'absolute border-r border-b p-0' +
                          (isFocus
                            ? ' ring-2 ring-primary ring-inset' + (!isSingleSelection ? ' bg-primary/10' : '')
                            : isSelected
                              ? ' bg-primary/10'
                              : ' hover:bg-accent/50')
                        }
                        style={{
                          top: vr.start,
                          left: vc.start,
                          width: vc.size,
                          height: vr.size
                        }}
                        onMouseDown={(e) => handleCellMouseDown(ri, ci, e)}
                        onMouseEnter={() => handleCellMouseEnter(ri, ci)}
                        onDoubleClick={(e) => {
                          if (e.button !== 0) return
                          handleCellStartEdit(ri, ci)
                        }}
                        onContextMenu={() => {
                          if (!isSelected && !isFocus) {
                            setSelection({ anchor: { row: ri, col: ci }, focus: { row: ri, col: ci } })
                          }
                          setEditingCell(null)
                        }}
                      >
                        <EditableCell
                          value={data[ri]?.[ci] ?? ''}
                          onChange={(v) => onUpdateCell(ri, ci, v)}
                          isEditing={isEditing}
                          onStopEdit={handleStopEdit}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            <ContextMenuItem onClick={handleContextCut}>잘라내기</ContextMenuItem>
            <ContextMenuItem onClick={handleContextCopy}>복사하기</ContextMenuItem>
            <ContextMenuItem onClick={handleContextPaste}>붙여넣기</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={handleContextDelete}>
              셀 지우기
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  )
}

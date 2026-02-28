/* eslint-disable prettier/prettier */
import { JSX, useCallback, useRef, useEffect } from 'react'
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
import {
  ROW_HEIGHT,
  HEADER_HEIGHT,
  ROW_NUM_WIDTH,
  ADD_COL_WIDTH,
  DEFAULT_COL_WIDTH
} from '../model/types'
import { useCsvSelection } from '../model/use-csv-selection'
import { useCsvClipboard } from '../model/use-csv-clipboard'
import { useCsvKeyboard } from '../model/use-csv-keyboard'
import { useCsvColumnResize } from '../model/use-csv-column-resize'
import { EditableCell } from './EditableCell'
import { EditableColumnHeader } from './EditableColumnHeader'

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

  // --- Hooks ---
  const sel = useCsvSelection(scrollRef, rowVirtualizer, colVirtualizer)
  const clipboard = useCsvClipboard(sel.selection, sel.selectionRange, data, headers, onUpdateCells)
  const { handleKeyDown } = useCsvKeyboard(
    sel.selection,
    sel.selectionRange,
    sel.isSingleSelection,
    sel.editingCell,
    sel.setSelection,
    sel.setEditingCell,
    clipboard,
    data.length,
    headers.length,
    onUndo,
    onRedo
  )
  const { handleResizeStart } = useCsvColumnResize(getColWidth, onColumnSizingChange)

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
        <ContextMenu onOpenChange={(open) => { sel.contextMenuOpenRef.current = open }}>
          <ContextMenuTrigger asChild>
            <div
              ref={scrollRef}
              className="flex-1 overflow-auto outline-none select-none"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onBlur={sel.handleBlur}
              onMouseUp={sel.handleMouseUp}
            >
              <div style={{ width: colTotalSize + ADD_COL_WIDTH, height: rowTotalSize, position: 'relative' }}>
                {virtualRows.flatMap((vr) =>
                  virtualCols.map((vc) => {
                    const ri = vr.index
                    const ci = vc.index
                    const isEditing = sel.editingCell?.row === ri && sel.editingCell?.col === ci
                    const isFocus = sel.selection?.focus.row === ri && sel.selection?.focus.col === ci
                    const isSelected =
                      sel.selectionRange != null &&
                      ri >= sel.selectionRange.startRow &&
                      ri <= sel.selectionRange.endRow &&
                      ci >= sel.selectionRange.startCol &&
                      ci <= sel.selectionRange.endCol

                    return (
                      <div
                        key={`${ri}_${ci}`}
                        className={
                          'absolute border-r border-b p-0' +
                          (isFocus
                            ? ' ring-2 ring-primary ring-inset' + (!sel.isSingleSelection ? ' bg-primary/10' : '')
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
                        onMouseDown={(e) => sel.handleCellMouseDown(ri, ci, e)}
                        onMouseEnter={() => sel.handleCellMouseEnter(ri, ci)}
                        onDoubleClick={(e) => {
                          if (e.button !== 0) return
                          sel.handleCellStartEdit(ri, ci)
                        }}
                        onContextMenu={() => {
                          if (!isSelected && !isFocus) {
                            sel.setSelection({ anchor: { row: ri, col: ci }, focus: { row: ri, col: ci } })
                          }
                          sel.setEditingCell(null)
                        }}
                      >
                        <EditableCell
                          value={data[ri]?.[ci] ?? ''}
                          onChange={(v) => onUpdateCell(ri, ci, v)}
                          isEditing={isEditing}
                          onStopEdit={sel.handleStopEdit}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            <ContextMenuItem onClick={clipboard.cut}>잘라내기</ContextMenuItem>
            <ContextMenuItem onClick={clipboard.copy}>복사하기</ContextMenuItem>
            <ContextMenuItem onClick={clipboard.paste}>붙여넣기</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={clipboard.deleteSelection}>
              셀 지우기
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  )
}

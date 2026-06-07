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
  DEFAULT_COL_WIDTH,
  type CellPos
} from '../model/types'
import { computeEnterMove } from '../model/nav'
import { useCsvSelection } from '../model/use-csv-selection'
import { useCsvClipboard } from '../model/use-csv-clipboard'
import { useCsvKeyboard } from '../model/use-csv-keyboard'
import { useCsvColumnResize } from '../model/use-csv-column-resize'
import { EditableCell } from './EditableCell'
import { CsvCellEditor } from './CsvCellEditor'
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
  focusCell?: CellPos | null
  matchedCells?: Set<string>
  onSearchClear?: () => void
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
  onRedo,
  focusCell,
  matchedCells,
  onSearchClear
}: Props): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const rowNumRef = useRef<HTMLDivElement>(null)
  // Tab→Enter 복귀용: 직전 Tab 입력 시작 열. Arrow/마우스/Escape 시 null 로 리셋.
  const tabStartColRef = useRef<number | null>(null)

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

  // columnSizing 변경 시 virtualizer 재측정
  useEffect(() => {
    colVirtualizer.measure()
  }, [colVirtualizer, columnSizing])

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
    sel.beginEdit,
    clipboard,
    data.length,
    headers.length,
    sel.lockedActive,
    sel.setLockedActive,
    tabStartColRef,
    onUndo,
    onRedo
  )
  const { handleResizeStart } = useCsvColumnResize(getColWidth, onColumnSizingChange)

  // --- Search focus ---
  useEffect(() => {
    if (!focusCell || focusCell.row < 0) return
    sel.setSelection({ anchor: focusCell, focus: focusCell })
  }, [focusCell]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Commit-and-move 콜백 ---
  // source 'tab'  : 열 끝 도달 시 다음/이전 행 wrap + 입력 시작 열 기록 + 마지막행 자동추가
  // source 'enter': Tab→Enter 복귀(tabStartCol) 적용 후 한 칸 아래 + 마지막행 자동추가
  // source 'arrow': 방향키 부호 그대로 직접 이동(wrap/자동추가 없음, tab 시퀀스 종료)
  const handleCommitAndMove = useCallback(
    (dRow: number, dCol: number, source: 'tab' | 'enter' | 'arrow' = 'tab') => {
      if (!sel.selection) return
      const { row, col } = sel.selection.focus

      if (source === 'tab') {
        // 입력 시작 열 기록 (헤더는 제외)
        if (tabStartColRef.current === null && row >= 0) tabStartColRef.current = col
        let newCol = col + dCol
        let newRow = row
        if (newCol >= headers.length) {
          newCol = 0
          newRow = row + 1
        } else if (newCol < 0) {
          newCol = headers.length - 1
          newRow = row - 1
        }
        let maxRow = data.length - 1
        if (newRow > maxRow && row >= 0) {
          onAddRowAt(data.length)
          maxRow = data.length
        }
        newRow = Math.max(-1, Math.min(maxRow, newRow))
        newCol = Math.max(0, Math.min(headers.length - 1, newCol))
        const next = { row: newRow, col: newCol }
        sel.setSelection({ anchor: next, focus: next })
        return
      }

      if (source === 'enter') {
        const target = computeEnterMove({ row, col }, tabStartColRef.current)
        let maxRow = data.length - 1
        if (target.row > maxRow && row >= 0) {
          onAddRowAt(data.length)
          maxRow = data.length
        }
        const newRow = Math.max(-1, Math.min(maxRow, target.row))
        const newCol = Math.max(0, Math.min(headers.length - 1, target.col))
        const next = { row: newRow, col: newCol }
        sel.setSelection({ anchor: next, focus: next })
        return
      }

      // source === 'arrow' → 방향 그대로 이동, tab 시퀀스 종료
      tabStartColRef.current = null
      const newRow = Math.max(-1, Math.min(data.length - 1, row + dRow))
      const newCol = Math.max(0, Math.min(headers.length - 1, col + dCol))
      const next = { row: newRow, col: newCol }
      sel.setSelection({ anchor: next, focus: next })
    },
    [sel, headers.length, data.length, onAddRowAt]
  )

  // --- 헤더 셀 mousedown: selection 만 (편집 모드 진입은 더블 클릭 / Enter) ---
  // preventDefault: 브라우저 mousedown 기본 동작이 클릭한 element (헤더 div, focusable 아님)
  // 로 focus 를 옮기려 하므로, scrollRef.focus() 가 그 직후 무효화될 수 있다. preventDefault
  // 로 기본 focus 이동을 막고 명시적으로 scrollRef 에 focus.
  const handleHeaderMouseDown = useCallback(
    (ci: number, e: React.MouseEvent) => {
      if (e.button !== 0) return
      // preventDefault: 브라우저 기본 focus(scrollRef)를 막아 헤더 floating editor 가 self-focus 하도록.
      e.preventDefault()
      tabStartColRef.current = null
      sel.setLockedActive(null)
      sel.setSelection({ anchor: { row: -1, col: ci }, focus: { row: -1, col: ci } })
      sel.setEditingCell(null)
    },
    [sel]
  )

  const handleHeaderStartEdit = useCallback(
    (ci: number) => {
      sel.setSelection({ anchor: { row: -1, col: ci }, focus: { row: -1, col: ci } })
      sel.setEditingCell({ row: -1, col: ci })
    },
    [sel]
  )

  // --- Computed ---
  // active 셀 = 범위 순환 중이면 lockedActive, 아니면 selection.focus
  const activeCell = sel.lockedActive ?? sel.selection?.focus ?? null
  // 단일 선택된 body 셀이면 floating editor 가 그 위에 뜸 (헤더/범위는 제외)
  const editorCell = sel.isSingleSelection && activeCell && activeCell.row >= 0 ? activeCell : null
  // 단일 선택된 헤더 셀(row = -1)이면 헤더 영역에 floating editor 가 뜸
  const headerEditorCol =
    sel.isSingleSelection && activeCell && activeCell.row === -1 ? activeCell.col : null

  // col 의 left offset (가변 폭 합산)
  const getColLeft = useCallback(
    (col: number) => {
      let x = 0
      for (let i = 0; i < col; i++) x += getColWidth(i)
      return x
    },
    [getColWidth]
  )

  // floating editor(body/header) 가 없을 때(범위/none)만 grid 에 focus 회수
  useEffect(() => {
    if (sel.editingCell) return
    if (sel.selection && !editorCell && headerEditorCol === null) scrollRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.selection, sel.editingCell, editorCell?.row, editorCell?.col, headerEditorCol])

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
      <div className="flex shrink-0" style={{ height: HEADER_HEIGHT }}>
        {/* Corner */}
        <div
          className="shrink-0 flex items-center justify-center border-r border-b bg-muted text-xs text-muted-foreground"
          style={{ width: ROW_NUM_WIDTH }}
        >
          #
        </div>
        {/* Scrollable column headers */}
        <div ref={headerRef} className="flex-1 overflow-hidden">
          {/* onKeyDown/onBlur: 헤더 floating editor 의 네비/blur 를 body 와 동일하게 처리 */}
          <div
            style={{
              width: colTotalSize + ADD_COL_WIDTH,
              height: HEADER_HEIGHT,
              position: 'relative'
            }}
            onKeyDown={handleKeyDown}
            onBlur={sel.handleBlur}
          >
            {virtualCols.map((vc) => {
              const ci = vc.index
              const isHeaderFocus = activeCell?.row === -1 && activeCell?.col === ci
              return (
                <div
                  key={`h_${ci}`}
                  className={
                    'absolute top-0 flex items-center px-2 text-sm font-medium border-r border-b bg-muted hover:bg-muted-foreground/10' +
                    (isHeaderFocus ? ' ring-2 ring-primary ring-inset' : '')
                  }
                  style={{ left: vc.start, width: vc.size, height: HEADER_HEIGHT }}
                  onMouseDown={(e) => handleHeaderMouseDown(ci, e)}
                >
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div className="flex-1 min-w-0">
                        <EditableColumnHeader
                          name={headers[ci]}
                          colIndex={ci}
                          onRemove={onRemoveColumn}
                          onStartEdit={() => handleHeaderStartEdit(ci)}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-44">
                      <ContextMenuItem onClick={() => onAddColumnAt(ci)}>
                        왼쪽에 열 추가
                      </ContextMenuItem>
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
              <button
                className="p-1 text-muted-foreground hover:text-foreground"
                onClick={() => onAddColumn()}
              >
                <Plus className="size-4" />
              </button>
            </div>
            {/* active(단일) 헤더 셀 위 floating editor — body 와 동일하게 IME/포커스 유지 */}
            {headerEditorCol !== null && (
              <CsvCellEditor
                cellKey={`h_${headerEditorCol}`}
                top={0}
                left={getColLeft(headerEditorCol)}
                width={getColWidth(headerEditorCol)}
                height={HEADER_HEIGHT}
                value={headers[headerEditorCol] ?? ''}
                onChange={(v) => onRenameColumn(headerEditorCol, v)}
                isEditing={sel.editingCell?.row === -1 && sel.editingCell?.col === headerEditorCol}
                initialValue={sel.editSeed}
                onStartEditing={() => sel.setEditingCell({ row: -1, col: headerEditorCol })}
                onStopEdit={sel.handleStopEdit}
                onCommitAndMove={handleCommitAndMove}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* Row numbers */}
        <div ref={rowNumRef} className="shrink-0 overflow-hidden" style={{ width: ROW_NUM_WIDTH }}>
          <div style={{ height: rowTotalSize, position: 'relative' }}>
            {virtualRows.map((vr) => (
              <div
                key={`rn_${vr.index}`}
                className="absolute flex items-center justify-center text-xs text-muted-foreground border-b border-r bg-muted/30 group"
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
                    <ContextMenuItem onClick={() => onAddRowAt(vr.index)}>
                      위에 행 추가
                    </ContextMenuItem>
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
        <ContextMenu
          onOpenChange={(open) => {
            sel.contextMenuOpenRef.current = open
          }}
        >
          <ContextMenuTrigger asChild>
            <div
              ref={scrollRef}
              className="flex-1 overflow-auto outline-none select-none scrollbar-thin"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onBlur={sel.handleBlur}
              onMouseUp={sel.handleMouseUp}
            >
              <div
                style={{
                  width: colTotalSize + ADD_COL_WIDTH,
                  height: rowTotalSize,
                  position: 'relative'
                }}
              >
                {virtualRows.flatMap((vr) =>
                  virtualCols.map((vc) => {
                    const ri = vr.index
                    const ci = vc.index
                    const isFocus = activeCell?.row === ri && activeCell?.col === ci
                    const isSelected =
                      sel.selectionRange != null &&
                      ri >= sel.selectionRange.startRow &&
                      ri <= sel.selectionRange.endRow &&
                      ci >= sel.selectionRange.startCol &&
                      ci <= sel.selectionRange.endCol
                    const isSearchMatch = matchedCells?.has(`${ri}_${ci}`) ?? false

                    return (
                      <div
                        key={`${ri}_${ci}`}
                        className={
                          'absolute border-r border-b p-0' +
                          (isFocus
                            ? ' ring-2 ring-primary ring-inset' +
                              (!sel.isSingleSelection ? ' bg-primary/10' : '')
                            : isSelected
                              ? ' bg-primary/10'
                              : isSearchMatch
                                ? ' bg-yellow-200/30'
                                : ' hover:bg-accent/50')
                        }
                        style={{
                          top: vr.start,
                          left: vc.start,
                          width: vc.size,
                          height: vr.size
                        }}
                        onMouseDown={(e) => {
                          // 브라우저 기본 mousedown 이 focusable 조상(scrollRef)으로 포커스를 가져가
                          // floating editor 의 self-focus 를 이겨 한글 IME 가 깨지는 것 방지.
                          // (active 셀 재클릭은 editor input=별도 형제라 이 핸들러를 안 타므로 영향 없음)
                          if (e.button === 0) e.preventDefault()
                          onSearchClear?.()
                          tabStartColRef.current = null
                          sel.handleCellMouseDown(ri, ci, e)
                        }}
                        onMouseEnter={() => sel.handleCellMouseEnter(ri, ci)}
                        onDoubleClick={(e) => {
                          if (e.button !== 0) return
                          sel.handleCellStartEdit(ri, ci)
                        }}
                        onContextMenu={() => {
                          if (!isSelected && !isFocus) {
                            sel.setSelection({
                              anchor: { row: ri, col: ci },
                              focus: { row: ri, col: ci }
                            })
                          }
                          sel.setEditingCell(null)
                        }}
                      >
                        <EditableCell value={data[ri]?.[ci] ?? ''} />
                      </div>
                    )
                  })
                )}
                {/* active(단일 body) 셀 위 floating editor — 항상 마운트되어 IME/포커스 유지 */}
                {editorCell && (
                  <CsvCellEditor
                    cellKey={`${editorCell.row}_${editorCell.col}`}
                    top={editorCell.row * ROW_HEIGHT}
                    left={getColLeft(editorCell.col)}
                    width={getColWidth(editorCell.col)}
                    height={ROW_HEIGHT}
                    value={data[editorCell.row]?.[editorCell.col] ?? ''}
                    onChange={(v) => onUpdateCell(editorCell.row, editorCell.col, v)}
                    isEditing={
                      sel.editingCell?.row === editorCell.row &&
                      sel.editingCell?.col === editorCell.col
                    }
                    initialValue={sel.editSeed}
                    onStartEditing={() =>
                      sel.setEditingCell({ row: editorCell.row, col: editorCell.col })
                    }
                    onStopEdit={sel.handleStopEdit}
                    onCommitAndMove={handleCommitAndMove}
                  />
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

import { JSX, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ColumnSizingState, Updater } from '@tanstack/react-table'
import { useUpdateCsvMeta, isOwnWrite } from '@entities/csv-file'
import { useCsvEditor } from '../model/use-csv-editor'
import { useCsvExternalSync } from '../model/use-csv-external-sync'
import { CsvToolbar } from './CsvToolbar'
import { CsvTable } from './CsvTable'

interface Props {
  workspaceId: string
  csvId: string
  initialContent: string
  initialColumnWidths: string | null
}

function parseColumnWidths(json: string | null): ColumnSizingState {
  if (!json) return {}
  try {
    return JSON.parse(json) as ColumnSizingState
  } catch {
    return {}
  }
}

/** 열 삽입 시 col_N 키를 시프트 (index 이상 → +1) */
function shiftSizingInsert(sizing: ColumnSizingState, index: number): ColumnSizingState {
  const next: ColumnSizingState = {}
  for (const [key, value] of Object.entries(sizing)) {
    const match = key.match(/^col_(\d+)$/)
    if (!match) continue
    const ci = Number(match[1])
    next[ci >= index ? `col_${ci + 1}` : key] = value
  }
  return next
}

/** 열 삭제 시 col_N 키를 시프트 (index 초과 → -1, index 삭제) */
function shiftSizingRemove(sizing: ColumnSizingState, index: number): ColumnSizingState {
  const next: ColumnSizingState = {}
  for (const [key, value] of Object.entries(sizing)) {
    const match = key.match(/^col_(\d+)$/)
    if (!match) continue
    const ci = Number(match[1])
    if (ci === index) continue
    next[ci > index ? `col_${ci - 1}` : key] = value
  }
  return next
}

export function CsvViewer({
  workspaceId,
  csvId,
  initialContent,
  initialColumnWidths
}: Props): JSX.Element {
  const [key, setKey] = useState(0)
  const queryClient = useQueryClient()

  const {
    data,
    headers,
    updateCell,
    updateCells,
    addRow,
    addRowAt,
    removeRow,
    addColumn,
    addColumnAt,
    removeColumn,
    renameColumn,
    undo,
    redo,
    canUndo,
    canRedo,
    isDirty,
    reset
  } = useCsvEditor(workspaceId, csvId, initialContent)

  // 열 너비 상태
  const initialSizing = useMemo(() => parseColumnWidths(initialColumnWidths), [initialColumnWidths])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(initialSizing)

  // 열 너비 영속화 (debounce 500ms)
  const { mutate: updateMeta } = useUpdateCsvMeta()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleColumnSizingChange = useCallback(
    (updater: Updater<ColumnSizingState>) => {
      setColumnSizing((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        // debounce 저장
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
          updateMeta({
            workspaceId,
            csvId,
            data: { columnWidths: JSON.stringify(next) }
          })
        }, 500)
        return next
      })
    },
    [workspaceId, csvId, updateMeta]
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // 외부 변경 시 에디터 리셋
  const handleExternalChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['csv', 'content', csvId] })
    setKey((k) => k + 1)
  }, [queryClient, csvId])

  useCsvExternalSync(csvId, handleExternalChange)

  // 외부 변경으로 initialContent가 바뀌면 에디터 리셋 + remount (자체 저장은 제외)
  useEffect(() => {
    if (!isOwnWrite(csvId)) {
      reset(initialContent)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKey((k) => k + 1)
    }
  }, [initialContent, csvId, reset])

  const handleAddColumn = useCallback(() => addColumn(), [addColumn])

  const handleAddColumnAt = useCallback(
    (index: number, name?: string) => {
      setColumnSizing((prev) => shiftSizingInsert(prev, index))
      addColumnAt(index, name)
    },
    [addColumnAt]
  )

  const handleRemoveColumn = useCallback(
    (colIndex: number) => {
      setColumnSizing((prev) => shiftSizingRemove(prev, colIndex))
      removeColumn(colIndex)
    },
    [removeColumn]
  )

  return (
    <div className="flex flex-col h-full">
      <CsvToolbar
        rowCount={data.length}
        colCount={headers.length}
        isDirty={isDirty}
        canUndo={canUndo}
        canRedo={canRedo}
        onAddRow={addRow}
        onAddColumn={handleAddColumn}
        onUndo={undo}
        onRedo={redo}
      />
      <div className="flex-1 overflow-hidden" key={key}>
        <CsvTable
          headers={headers}
          data={data}
          columnSizing={columnSizing}
          onColumnSizingChange={handleColumnSizingChange}
          onUpdateCell={updateCell}
          onUpdateCells={updateCells}
          onRemoveRow={removeRow}
          onAddRowAt={addRowAt}
          onAddColumn={addColumn}
          onAddColumnAt={handleAddColumnAt}
          onRemoveColumn={handleRemoveColumn}
          onRenameColumn={renameColumn}
          onUndo={undo}
          onRedo={redo}
        />
      </div>
    </div>
  )
}

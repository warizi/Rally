import { useCallback } from 'react'
import type { Updater } from '@tanstack/react-table'
import type { ColumnSizingState } from '@tanstack/react-table'
import { MIN_COL_WIDTH } from './types'

export interface UseCsvColumnResizeReturn {
  handleResizeStart: (colIndex: number, e: React.MouseEvent) => void
}

export function useCsvColumnResize(
  getColWidth: (index: number) => number,
  onColumnSizingChange: (updater: Updater<ColumnSizingState>) => void
): UseCsvColumnResizeReturn {
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

  return { handleResizeStart }
}

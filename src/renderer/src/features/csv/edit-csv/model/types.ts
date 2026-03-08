export type CellPos = { row: number; col: number }

export type Selection = { anchor: CellPos; focus: CellPos }

export type SelectionRange = {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

export const ROW_HEIGHT = 28
export const HEADER_HEIGHT = 32
export const ROW_NUM_WIDTH = 50
export const ADD_COL_WIDTH = 40
export const DEFAULT_COL_WIDTH = 150
export const MIN_COL_WIDTH = 60

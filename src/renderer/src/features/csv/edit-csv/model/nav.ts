import type { CellPos, SelectionRange } from './types'

/**
 * 범위 선택 상태에서 active 셀을 범위 안에서만 순환 이동.
 * - axis 'row': Tab — 행 우선(가로로 이동 후 다음 행)
 * - axis 'col': Enter — 열 우선(세로로 이동 후 다음 열)
 * - dir +1 정방향 / -1 역방향
 * 끝에 도달하면 반대편으로 wrap.
 */
export function nextInRange(
  active: CellPos,
  range: SelectionRange,
  dir: 1 | -1,
  axis: 'row' | 'col'
): CellPos {
  const cols = range.endCol - range.startCol + 1
  const rows = range.endRow - range.startRow + 1
  const total = cols * rows
  if (total <= 1) return { row: range.startRow, col: range.startCol }

  const relCol = Math.min(Math.max(active.col - range.startCol, 0), cols - 1)
  const relRow = Math.min(Math.max(active.row - range.startRow, 0), rows - 1)

  if (axis === 'row') {
    let idx = relRow * cols + relCol
    idx = (idx + dir + total) % total
    return { row: range.startRow + Math.floor(idx / cols), col: range.startCol + (idx % cols) }
  }
  let idx = relCol * rows + relRow
  idx = (idx + dir + total) % total
  return { row: range.startRow + (idx % rows), col: range.startCol + Math.floor(idx / rows) }
}

/**
 * 편집 커밋 후 Enter(아래 이동) 목적지 계산.
 * tabStartCol 이 기록돼 있으면(직전 Tab 입력 시작 열) 그 열로 복귀, 아니면 현재 열 유지.
 * 행은 +1. 경계 clamp / 마지막 행 auto-add 는 호출측에서 처리.
 */
export function computeEnterMove(pos: CellPos, tabStartCol: number | null): CellPos {
  return { row: pos.row + 1, col: tabStartCol ?? pos.col }
}

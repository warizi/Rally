import { describe, it, expect } from 'vitest'
import { nextInRange, computeEnterMove } from '../nav'
import type { SelectionRange } from '../types'

const RANGE_2x2: SelectionRange = { startRow: 0, endRow: 1, startCol: 0, endCol: 1 }

describe('nextInRange — row axis (Tab, 행 우선)', () => {
  it('(0,0) → (0,1)', () => {
    expect(nextInRange({ row: 0, col: 0 }, RANGE_2x2, 1, 'row')).toEqual({ row: 0, col: 1 })
  })
  it('(0,1) → 다음 행 첫 열 (1,0)', () => {
    expect(nextInRange({ row: 0, col: 1 }, RANGE_2x2, 1, 'row')).toEqual({ row: 1, col: 0 })
  })
  it('마지막 (1,1) → wrap (0,0)', () => {
    expect(nextInRange({ row: 1, col: 1 }, RANGE_2x2, 1, 'row')).toEqual({ row: 0, col: 0 })
  })
  it('역방향 (0,0) → wrap 마지막 (1,1)', () => {
    expect(nextInRange({ row: 0, col: 0 }, RANGE_2x2, -1, 'row')).toEqual({ row: 1, col: 1 })
  })
})

describe('nextInRange — col axis (Enter, 열 우선)', () => {
  it('(0,0) → 아래 (1,0)', () => {
    expect(nextInRange({ row: 0, col: 0 }, RANGE_2x2, 1, 'col')).toEqual({ row: 1, col: 0 })
  })
  it('(1,0) → 다음 열 첫 행 (0,1)', () => {
    expect(nextInRange({ row: 1, col: 0 }, RANGE_2x2, 1, 'col')).toEqual({ row: 0, col: 1 })
  })
  it('마지막 (1,1) → wrap (0,0)', () => {
    expect(nextInRange({ row: 1, col: 1 }, RANGE_2x2, 1, 'col')).toEqual({ row: 0, col: 0 })
  })
})

describe('nextInRange — 오프셋 범위', () => {
  it('startRow/startCol 이 0이 아니어도 범위 기준 순환', () => {
    const range: SelectionRange = { startRow: 2, endRow: 3, startCol: 1, endCol: 2 }
    expect(nextInRange({ row: 2, col: 2 }, range, 1, 'row')).toEqual({ row: 3, col: 1 })
  })
  it('단일 셀 범위 → 자기 자신', () => {
    const range: SelectionRange = { startRow: 1, endRow: 1, startCol: 1, endCol: 1 }
    expect(nextInRange({ row: 1, col: 1 }, range, 1, 'row')).toEqual({ row: 1, col: 1 })
  })
})

describe('computeEnterMove — Tab→Enter 복귀', () => {
  it('tabStartCol 없으면 현재 열 유지 + row+1', () => {
    expect(computeEnterMove({ row: 2, col: 3 }, null)).toEqual({ row: 3, col: 3 })
  })
  it('tabStartCol 있으면 그 열로 복귀 + row+1', () => {
    expect(computeEnterMove({ row: 2, col: 3 }, 1)).toEqual({ row: 3, col: 1 })
  })
})

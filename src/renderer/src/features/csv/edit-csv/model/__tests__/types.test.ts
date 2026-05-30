/**
 * features/csv/edit-csv/model/types.test.ts — CSV grid layout 상수
 */
import { describe, it, expect } from 'vitest'
import {
  ROW_HEIGHT,
  HEADER_HEIGHT,
  ROW_NUM_WIDTH,
  ADD_COL_WIDTH,
  DEFAULT_COL_WIDTH,
  MIN_COL_WIDTH
} from '../types'

describe('CSV layout 상수', () => {
  it('ROW_HEIGHT=28, HEADER_HEIGHT=32', () => {
    expect(ROW_HEIGHT).toBe(28)
    expect(HEADER_HEIGHT).toBe(32)
  })

  it('ROW_NUM_WIDTH=50, ADD_COL_WIDTH=40', () => {
    expect(ROW_NUM_WIDTH).toBe(50)
    expect(ADD_COL_WIDTH).toBe(40)
  })

  it('DEFAULT_COL_WIDTH(150) > MIN_COL_WIDTH(60)', () => {
    expect(DEFAULT_COL_WIDTH).toBe(150)
    expect(MIN_COL_WIDTH).toBe(60)
    expect(DEFAULT_COL_WIDTH).toBeGreaterThan(MIN_COL_WIDTH)
  })
})

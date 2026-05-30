/**
 * entities/tab-system/lib/constants.test.ts
 */
import { describe, it, expect } from 'vitest'
import { PANE_DEFAULTS, LAYOUT_DEFAULTS } from '../constants'

describe('PANE_DEFAULTS', () => {
  it('MIN_SIZE + DEFAULT_SIZE 값 검증', () => {
    expect(PANE_DEFAULTS.MIN_SIZE).toBe(200)
    expect(PANE_DEFAULTS.DEFAULT_SIZE).toBe(50)
  })
})

describe('LAYOUT_DEFAULTS', () => {
  it('DEFAULT_PANE_ID + DEFAULT_SPLIT_SIZE', () => {
    expect(LAYOUT_DEFAULTS.DEFAULT_PANE_ID).toBe('main')
    expect(LAYOUT_DEFAULTS.DEFAULT_SPLIT_SIZE).toBe(50)
  })
})

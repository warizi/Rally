/**
 * Toolbar 팔레트 기본값 무결성.
 */
import { describe, it, expect } from 'vitest'
import { DEFAULT_TOOLBAR_PALETTE } from '../defaults'
import { PALETTE_SLOT_COUNT } from '../types'

const HEX_RE = /^#[0-9a-fA-F]{6}$/

describe('DEFAULT_TOOLBAR_PALETTE', () => {
  it('PALETTE_SLOT_COUNT 는 8', () => {
    expect(PALETTE_SLOT_COUNT).toBe(8)
  })

  it('8 슬롯', () => {
    expect(DEFAULT_TOOLBAR_PALETTE).toHaveLength(8)
  })

  it('모든 색상이 6자리 hex (#RRGGBB)', () => {
    for (let i = 0; i < PALETTE_SLOT_COUNT; i++) {
      expect(DEFAULT_TOOLBAR_PALETTE[i], `slot ${i}`).toMatch(HEX_RE)
    }
  })

  it('8색이 모두 다름 (중복 없음)', () => {
    const set = new Set(DEFAULT_TOOLBAR_PALETTE.map((c) => c.toLowerCase()))
    expect(set.size).toBe(PALETTE_SLOT_COUNT)
  })
})

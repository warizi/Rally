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

  it('light / dark 각각 8 슬롯', () => {
    expect(DEFAULT_TOOLBAR_PALETTE.light).toHaveLength(8)
    expect(DEFAULT_TOOLBAR_PALETTE.dark).toHaveLength(8)
  })

  it('모든 색상이 6자리 hex (#RRGGBB)', () => {
    for (let i = 0; i < PALETTE_SLOT_COUNT; i++) {
      expect(DEFAULT_TOOLBAR_PALETTE.light[i], `light[${i}]`).toMatch(HEX_RE)
      expect(DEFAULT_TOOLBAR_PALETTE.dark[i], `dark[${i}]`).toMatch(HEX_RE)
    }
  })

  it('각 슬롯의 라이트/다크 색상은 다름 (가독성)', () => {
    for (let i = 0; i < PALETTE_SLOT_COUNT; i++) {
      expect(DEFAULT_TOOLBAR_PALETTE.light[i].toLowerCase(), `slot ${i} light vs dark`).not.toBe(
        DEFAULT_TOOLBAR_PALETTE.dark[i].toLowerCase()
      )
    }
  })

  it('같은 모드 내에서 8색이 모두 다름 (중복 없음)', () => {
    const lightSet = new Set(DEFAULT_TOOLBAR_PALETTE.light.map((c) => c.toLowerCase()))
    const darkSet = new Set(DEFAULT_TOOLBAR_PALETTE.dark.map((c) => c.toLowerCase()))
    expect(lightSet.size).toBe(PALETTE_SLOT_COUNT)
    expect(darkSet.size).toBe(PALETTE_SLOT_COUNT)
  })
})

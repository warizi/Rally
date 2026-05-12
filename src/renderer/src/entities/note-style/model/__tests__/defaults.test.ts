/**
 * 노트 스타일 기본값 무결성 (Phase 1).
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_NOTE_STYLE_LIGHT,
  DEFAULT_NOTE_STYLE_DARK,
  DEFAULT_NOTE_STYLE_SETTINGS
} from '../defaults'
import { STYLE_ELEMENT_KEYS } from '../types'

describe('DEFAULT_NOTE_STYLE_*', () => {
  it('STYLE_ELEMENT_KEYS 는 10개 (h1-h6 + paragraph + codeInline + codeBlock + blockquote)', () => {
    expect(STYLE_ELEMENT_KEYS).toEqual([
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'paragraph',
      'codeInline',
      'codeBlock',
      'blockquote'
    ])
  })

  it('LIGHT set 에 10개 요소 모두 존재', () => {
    for (const key of STYLE_ELEMENT_KEYS) {
      expect(DEFAULT_NOTE_STYLE_LIGHT[key], `light.${key}`).toBeDefined()
    }
  })

  it('DARK set 에 10개 요소 모두 존재', () => {
    for (const key of STYLE_ELEMENT_KEYS) {
      expect(DEFAULT_NOTE_STYLE_DARK[key], `dark.${key}`).toBeDefined()
    }
  })

  it('각 요소가 5개 속성 (fontSize / lineHeight / marginTop / marginBottom / color) 보유', () => {
    for (const key of STYLE_ELEMENT_KEYS) {
      const s = DEFAULT_NOTE_STYLE_LIGHT[key]
      expect(s.fontSize, `${key}.fontSize`).toBeTruthy()
      expect(typeof s.lineHeight, `${key}.lineHeight`).toBe('number')
      expect(s.marginTop, `${key}.marginTop`).toBeTruthy()
      expect(s.marginBottom, `${key}.marginBottom`).toBeTruthy()
      expect(s.color, `${key}.color`).toBeTruthy()
    }
  })

  it('헤딩 크기는 h1 > h2 > h3 > h4 > h5 ≥ h6 순서로 감소', () => {
    const sizes = (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).map((k) =>
      parseFloat(DEFAULT_NOTE_STYLE_LIGHT[k].fontSize)
    )
    for (let i = 0; i < sizes.length - 1; i++) {
      expect(sizes[i], `h${i + 1} > h${i + 2}`).toBeGreaterThanOrEqual(sizes[i + 1])
    }
  })

  it('LIGHT 와 DARK 의 color 는 다름 (가독성)', () => {
    for (const key of STYLE_ELEMENT_KEYS) {
      const lightColor = DEFAULT_NOTE_STYLE_LIGHT[key].color
      const darkColor = DEFAULT_NOTE_STYLE_DARK[key].color
      // color 는 다르되 나머지 (fontSize, margin 등) 는 동일해야 함
      expect(lightColor, `${key} 의 light/dark color 가 같으면 안 됨`).not.toBe(darkColor)
    }
  })

  it('DEFAULT_NOTE_STYLE_SETTINGS 는 light + dark 모두 포함', () => {
    expect(DEFAULT_NOTE_STYLE_SETTINGS.light).toBe(DEFAULT_NOTE_STYLE_LIGHT)
    expect(DEFAULT_NOTE_STYLE_SETTINGS.dark).toBe(DEFAULT_NOTE_STYLE_DARK)
  })
})

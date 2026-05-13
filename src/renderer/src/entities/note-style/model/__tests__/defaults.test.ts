/**
 * 노트 스타일 기본값 무결성.
 */
import { describe, it, expect } from 'vitest'
import { DEFAULT_NOTE_STYLE_SETTINGS } from '../defaults'
import { STYLE_ELEMENT_KEYS } from '../types'

describe('DEFAULT_NOTE_STYLE_SETTINGS', () => {
  it('STYLE_ELEMENT_KEYS 는 11개 (h1-h6 + paragraph + codeInline + codeBlock + blockquote + hr)', () => {
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
      'blockquote',
      'hr'
    ])
  })

  it('11개 요소 모두 존재', () => {
    for (const key of STYLE_ELEMENT_KEYS) {
      expect(DEFAULT_NOTE_STYLE_SETTINGS[key], key).toBeDefined()
    }
  })

  it('각 요소가 모든 필드 (4 크기 + color×2 + bg×2 + border color×2 + borderWidth) 보유', () => {
    for (const key of STYLE_ELEMENT_KEYS) {
      const s = DEFAULT_NOTE_STYLE_SETTINGS[key]
      expect(s.fontSize, `${key}.fontSize`).toBeTruthy()
      expect(typeof s.lineHeight, `${key}.lineHeight`).toBe('number')
      expect(s.marginTop, `${key}.marginTop`).toBeTruthy()
      expect(s.marginBottom, `${key}.marginBottom`).toBeTruthy()
      expect(s.colorLight, `${key}.colorLight`).toBeTruthy()
      expect(s.colorDark, `${key}.colorDark`).toBeTruthy()
      expect(s.backgroundLight, `${key}.backgroundLight`).toBeTruthy()
      expect(s.backgroundDark, `${key}.backgroundDark`).toBeTruthy()
      expect(s.borderColorLight, `${key}.borderColorLight`).toBeTruthy()
      expect(s.borderColorDark, `${key}.borderColorDark`).toBeTruthy()
      expect(s.borderWidth, `${key}.borderWidth`).toBeTruthy()
    }
  })

  it('헤딩 크기는 h1 > h2 > h3 > h4 > h5 ≥ h6 순서로 감소', () => {
    const sizes = (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).map((k) =>
      parseFloat(DEFAULT_NOTE_STYLE_SETTINGS[k].fontSize)
    )
    for (let i = 0; i < sizes.length - 1; i++) {
      expect(sizes[i], `h${i + 1} >= h${i + 2}`).toBeGreaterThanOrEqual(sizes[i + 1])
    }
  })

  it('각 요소의 colorLight / colorDark 는 다름 (가독성)', () => {
    for (const key of STYLE_ELEMENT_KEYS) {
      const s = DEFAULT_NOTE_STYLE_SETTINGS[key]
      expect(s.colorLight, `${key}`).not.toBe(s.colorDark)
    }
  })

  it('blockquote / hr 는 borderWidth 가 0 보다 큼 (시각적 구분선 있음)', () => {
    expect(parseFloat(DEFAULT_NOTE_STYLE_SETTINGS.blockquote.borderWidth)).toBeGreaterThan(0)
    expect(parseFloat(DEFAULT_NOTE_STYLE_SETTINGS.hr.borderWidth)).toBeGreaterThan(0)
  })

  it('codeInline / codeBlock 은 실제 bg 색상, 나머지는 transparent', () => {
    expect(DEFAULT_NOTE_STYLE_SETTINGS.codeInline.backgroundLight).not.toBe('transparent')
    expect(DEFAULT_NOTE_STYLE_SETTINGS.codeBlock.backgroundLight).not.toBe('transparent')
    expect(DEFAULT_NOTE_STYLE_SETTINGS.h1.backgroundLight).toBe('transparent')
    expect(DEFAULT_NOTE_STYLE_SETTINGS.paragraph.backgroundLight).toBe('transparent')
  })
})

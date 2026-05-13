/**
 * 노트 스타일 기본값. 사용자 설정 미존재 또는 초기화 버튼 클릭 시 사용.
 *
 * Milkdown nord theme 기본 prose 스타일을 참고. 색상만 light/dark 분리,
 * 나머지 (font-size / line-height / margin) 는 공유.
 */
import type { ElementStyle, NoteStyleSettings } from './types'

const LIGHT_TEXT = '#1f2937' // gray-800
const LIGHT_MUTED = '#4b5563' // gray-600
const LIGHT_CODE = '#dc2626' // red-600
const LIGHT_BORDER = '#e5e7eb' // gray-200 (hr 라인용)

const DARK_TEXT = '#e5e7eb' // gray-200
const DARK_MUTED = '#9ca3af' // gray-400
const DARK_CODE = '#fca5a5' // red-300
const DARK_BORDER = '#374151' // gray-700

const LIGHT_CODE_BG = '#f3f4f6' // gray-100
const DARK_CODE_BG = '#27272a' // zinc-800
const LIGHT_BLOCK_BG = '#f3f4f6' // gray-100
const DARK_BLOCK_BG = '#18181b' // zinc-900

const NO_BG = 'transparent'

function commonHeading(
  fontSize: string,
  marginTop: string,
  colorLight: string,
  colorDark: string
): ElementStyle {
  return {
    fontSize,
    lineHeight: 1.3,
    marginTop,
    marginBottom: '0.5rem',
    colorLight,
    colorDark,
    backgroundLight: NO_BG,
    backgroundDark: NO_BG,
    borderColorLight: NO_BG,
    borderColorDark: NO_BG,
    borderWidth: '0'
  }
}

export const DEFAULT_NOTE_STYLE_SETTINGS: NoteStyleSettings = {
  h1: commonHeading('1.875rem', '1.5rem', LIGHT_TEXT, DARK_TEXT),
  h2: commonHeading('1.5rem', '1.25rem', LIGHT_TEXT, DARK_TEXT),
  h3: commonHeading('1.25rem', '1rem', LIGHT_TEXT, DARK_TEXT),
  h4: commonHeading('1.125rem', '0.875rem', LIGHT_TEXT, DARK_TEXT),
  h5: commonHeading('1rem', '0.75rem', LIGHT_TEXT, DARK_TEXT),
  h6: commonHeading('0.875rem', '0.625rem', LIGHT_MUTED, DARK_MUTED),
  paragraph: {
    fontSize: '1rem',
    lineHeight: 1.75,
    marginTop: '0.25rem',
    marginBottom: '0.75rem',
    colorLight: LIGHT_TEXT,
    colorDark: DARK_TEXT,
    backgroundLight: NO_BG,
    backgroundDark: NO_BG,
    borderColorLight: NO_BG,
    borderColorDark: NO_BG,
    borderWidth: '0'
  },
  codeInline: {
    fontSize: '0.875rem',
    lineHeight: 1.5,
    marginTop: '0',
    marginBottom: '0',
    colorLight: LIGHT_CODE,
    colorDark: DARK_CODE,
    backgroundLight: LIGHT_CODE_BG,
    backgroundDark: DARK_CODE_BG,
    borderColorLight: NO_BG,
    borderColorDark: NO_BG,
    borderWidth: '0'
  },
  codeBlock: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    marginTop: '0.75rem',
    marginBottom: '0.75rem',
    colorLight: LIGHT_TEXT,
    colorDark: DARK_TEXT,
    backgroundLight: LIGHT_BLOCK_BG,
    backgroundDark: DARK_BLOCK_BG,
    borderColorLight: NO_BG,
    borderColorDark: NO_BG,
    borderWidth: '0'
  },
  blockquote: {
    fontSize: '1rem',
    lineHeight: 1.75,
    marginTop: '0.75rem',
    marginBottom: '0.75rem',
    colorLight: LIGHT_MUTED,
    colorDark: DARK_MUTED,
    backgroundLight: NO_BG,
    backgroundDark: NO_BG,
    borderColorLight: LIGHT_MUTED,
    borderColorDark: DARK_MUTED,
    borderWidth: '3px'
  },
  hr: {
    // 텍스트 없는 요소 — fontSize/lineHeight/color/bg 는 미사용 (UI 에 숨김).
    // 기본값은 어색하지 않게 paragraph 와 동일하게 두어 동작 안전성 보장.
    fontSize: '1rem',
    lineHeight: 1,
    marginTop: '1rem',
    marginBottom: '1rem',
    colorLight: LIGHT_TEXT,
    colorDark: DARK_TEXT,
    backgroundLight: NO_BG,
    backgroundDark: NO_BG,
    borderColorLight: LIGHT_BORDER,
    borderColorDark: DARK_BORDER,
    borderWidth: '1px'
  }
}

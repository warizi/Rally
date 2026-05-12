/**
 * 노트 스타일 기본값. 사용자 설정 미존재 또는 초기화 버튼 클릭 시 사용.
 *
 * Milkdown nord theme 의 기본 prose 스타일을 참고해 사용자에게 익숙한
 * 출발점을 제공. 다크 모드는 color 만 다르고 나머지는 동일.
 */
import type { ElementStyle, NoteStyleSet, NoteStyleSettings } from './types'

const LIGHT_TEXT = '#1f2937' // gray-800
const LIGHT_MUTED = '#4b5563' // gray-600
const LIGHT_CODE_BG_TEXT = '#dc2626' // red-600

const DARK_TEXT = '#e5e7eb' // gray-200
const DARK_MUTED = '#9ca3af' // gray-400
const DARK_CODE_BG_TEXT = '#fca5a5' // red-300

function commonHeading(fontSize: string, marginTop: string, color: string): ElementStyle {
  return {
    fontSize,
    lineHeight: 1.3,
    marginTop,
    marginBottom: '0.5rem',
    color
  }
}

function buildSet(color: string, mutedColor: string, codeColor: string): NoteStyleSet {
  return {
    h1: commonHeading('1.875rem', '1.5rem', color),
    h2: commonHeading('1.5rem', '1.25rem', color),
    h3: commonHeading('1.25rem', '1rem', color),
    h4: commonHeading('1.125rem', '0.875rem', color),
    h5: commonHeading('1rem', '0.75rem', color),
    h6: commonHeading('0.875rem', '0.625rem', mutedColor),
    paragraph: {
      fontSize: '1rem',
      lineHeight: 1.6,
      marginTop: '0.25rem',
      marginBottom: '0.75rem',
      color
    },
    codeInline: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      marginTop: '0',
      marginBottom: '0',
      color: codeColor
    },
    codeBlock: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      marginTop: '0.75rem',
      marginBottom: '0.75rem',
      color
    },
    blockquote: {
      fontSize: '1rem',
      lineHeight: 1.6,
      marginTop: '0.75rem',
      marginBottom: '0.75rem',
      color: mutedColor
    }
  }
}

export const DEFAULT_NOTE_STYLE_LIGHT: NoteStyleSet = buildSet(
  LIGHT_TEXT,
  LIGHT_MUTED,
  LIGHT_CODE_BG_TEXT
)
export const DEFAULT_NOTE_STYLE_DARK: NoteStyleSet = buildSet(
  DARK_TEXT,
  DARK_MUTED,
  DARK_CODE_BG_TEXT
)

export const DEFAULT_NOTE_STYLE_SETTINGS: NoteStyleSettings = {
  light: DEFAULT_NOTE_STYLE_LIGHT,
  dark: DEFAULT_NOTE_STYLE_DARK
}

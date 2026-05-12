/**
 * 노트 마크다운 스타일 커스텀 — 타입 정의.
 *
 * 사용자가 설정 다이얼로그에서 편집 가능한 10개 요소 × 5속성, 라이트/다크
 * 모드별로 분리 저장.
 */

export interface ElementStyle {
  /** CSS font-size (예: '1.5rem', '24px'). */
  fontSize: string
  /** unitless number 또는 CSS 표현 (예: 1.5). */
  lineHeight: number
  /** CSS margin-top (예: '1rem'). */
  marginTop: string
  /** CSS margin-bottom. */
  marginBottom: string
  /** CSS color (예: '#1f2937', 'inherit'). */
  color: string
}

/** 편집 가능한 10개 마크다운 요소. */
export type StyleElementKey =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'paragraph'
  | 'codeInline'
  | 'codeBlock'
  | 'blockquote'

export const STYLE_ELEMENT_KEYS: readonly StyleElementKey[] = [
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
] as const

export type NoteStyleSet = Record<StyleElementKey, ElementStyle>

export type ThemeMode = 'light' | 'dark'

export interface NoteStyleSettings {
  light: NoteStyleSet
  dark: NoteStyleSet
}

/** app-settings 의 JSON 컬럼에 저장할 때 사용하는 키. */
export const NOTE_STYLE_SETTINGS_KEY = 'noteStyle'

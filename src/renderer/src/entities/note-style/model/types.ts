/**
 * 노트 마크다운 스타일 커스텀 — 타입 정의.
 *
 * 11개 요소 × N속성. 색상만 라이트/다크 분리, 나머지는 공유.
 * 다크 모드 CSS 는 `html.dark <selector>` 변형으로 자동 적용.
 */

export interface ElementStyle {
  /** CSS font-size (예: '1.5rem'). hr 처럼 텍스트 없는 요소엔 미사용. */
  fontSize: string
  /** unitless number 또는 CSS 표현. */
  lineHeight: number
  /** CSS margin-top. */
  marginTop: string
  /** CSS margin-bottom. */
  marginBottom: string
  /** 라이트 모드 글자색. */
  colorLight: string
  /** 다크 모드 글자색. */
  colorDark: string
  /** 라이트 모드 배경색. 배경 미사용 요소는 'transparent'. */
  backgroundLight: string
  /** 다크 모드 배경색. */
  backgroundDark: string
  /** 라이트 모드 경계선 색상 (blockquote 좌측, hr 가로선). 미사용 요소는 'transparent'. */
  borderColorLight: string
  /** 다크 모드 경계선 색상. */
  borderColorDark: string
  /** 경계선 굵기 (예: '3px'). 미사용 요소는 '0'. */
  borderWidth: string
}

/** 편집 가능한 11개 마크다운 요소. */
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
  | 'hr'

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
  'blockquote',
  'hr'
] as const

/** 라이트/다크 분리 없는 단일 set. 색상만 element 단위로 light/dark 분리. */
export type NoteStyleSettings = Record<StyleElementKey, ElementStyle>

/** @deprecated v2 부터 NoteStyleSettings 와 동일. legacy 코드 호환용. */
export type NoteStyleSet = NoteStyleSettings

/** 배경 편집을 UI 에 노출하는 요소 (codeInline / codeBlock / blockquote). */
export const ELEMENTS_WITH_BACKGROUND: ReadonlySet<StyleElementKey> = new Set([
  'codeInline',
  'codeBlock',
  'blockquote'
])

/** 경계선 (border) 편집을 UI 에 노출하는 요소 (blockquote 좌측, hr 가로선). */
export const ELEMENTS_WITH_BORDER: ReadonlySet<StyleElementKey> = new Set(['blockquote', 'hr'])

/** 텍스트가 없어 fontSize/lineHeight/color 필드를 숨길 요소 (hr 등). */
export const ELEMENTS_WITHOUT_TEXT: ReadonlySet<StyleElementKey> = new Set(['hr'])

/** app-settings 의 JSON 컬럼에 저장할 때 사용하는 키. */
export const NOTE_STYLE_SETTINGS_KEY = 'noteStyle'

/**
 * 노트 에디터 floating toolbar 의 색상 팔레트 — 타입 정의.
 *
 * 8개 슬롯 × 라이트/다크 분리. 파일에 저장되는 hex 는 라이트 모드 기준이며
 * 다크 모드 렌더링은 런타임 매핑으로 처리.
 */

/** 8개 슬롯 hex 색상 튜플. */
export type PaletteColors = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string
]

export interface ToolbarColorPalette {
  /** 라이트 모드 8색 (hex). 파일에 저장되는 기준값. */
  light: PaletteColors
  /** 다크 모드 8색 (hex). 라이트와 1:1 페어. */
  dark: PaletteColors
}

/** app-settings JSON 컬럼에 저장할 때 사용하는 키. */
export const NOTE_TOOLBAR_PALETTE_KEY = 'noteToolbarPalette'

/** 팔레트 슬롯 수. */
export const PALETTE_SLOT_COUNT = 8

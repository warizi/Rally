/**
 * 노트 에디터 floating toolbar 색상 팔레트 — 타입 정의.
 *
 * 8개 슬롯의 단일 hex 색상 배열. 라이트/다크 모드 분리 없음.
 * 색상은 사용자가 양 모드에서 모두 가독성 있도록 직접 선택.
 */

/** 8개 슬롯 hex 색상 튜플. */
export type ToolbarColorPalette = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string
]

/** app-settings JSON 컬럼에 저장할 때 사용하는 키. */
export const NOTE_TOOLBAR_PALETTE_KEY = 'noteToolbarPalette'

/** 팔레트 슬롯 수. */
export const PALETTE_SLOT_COUNT = 8

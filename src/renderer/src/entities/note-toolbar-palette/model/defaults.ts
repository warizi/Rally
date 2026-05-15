/**
 * 노트 에디터 toolbar 색상 팔레트 기본값.
 *
 * 8색 단일 배열 — 라이트/다크 양쪽에서 적절한 가독성을 갖는 중간 채도 색상.
 */
import type { ToolbarColorPalette } from './types'

export const DEFAULT_TOOLBAR_PALETTE: ToolbarColorPalette = [
  '#6b7280', // 기본 (gray-500)
  '#ef4444', // 빨강 (red-500)
  '#f97316', // 주황 (orange-500)
  '#eab308', // 노랑 (yellow-500)
  '#22c55e', // 초록 (green-500)
  '#06b6d4', // 청록 (cyan-500)
  '#3b82f6', // 파랑 (blue-500)
  '#a855f7' // 보라 (purple-500)
]

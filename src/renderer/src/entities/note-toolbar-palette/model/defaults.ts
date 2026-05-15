/**
 * 노트 에디터 toolbar 색상 팔레트 기본값.
 *
 * 라이트/다크 각각 8색. Tailwind 색상 팔레트 기반 — 라이트는 *-600 계열,
 * 다크는 *-300 계열로 가독성 확보.
 */
import type { ToolbarColorPalette } from './types'

export const DEFAULT_TOOLBAR_PALETTE: ToolbarColorPalette = {
  light: [
    '#1f2937', // 기본 (gray-800)
    '#dc2626', // 빨강 (red-600)
    '#ea580c', // 주황 (orange-600)
    '#ca8a04', // 노랑 (yellow-600)
    '#16a34a', // 초록 (green-600)
    '#0891b2', // 청록 (cyan-600)
    '#2563eb', // 파랑 (blue-600)
    '#9333ea' // 보라 (purple-600)
  ],
  dark: [
    '#e5e7eb', // 기본 (gray-200)
    '#fca5a5', // 빨강 (red-300)
    '#fdba74', // 주황 (orange-300)
    '#fde047', // 노랑 (yellow-300)
    '#86efac', // 초록 (green-300)
    '#67e8f9', // 청록 (cyan-300)
    '#93c5fd', // 파랑 (blue-300)
    '#d8b4fe' // 보라 (purple-300)
  ]
}

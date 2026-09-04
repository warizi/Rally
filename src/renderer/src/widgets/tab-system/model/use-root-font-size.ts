import { useSyncExternalStore } from 'react'
import { FONT_SIZE_CHANGE_EVENT } from '@shared/lib/theme'

const FALLBACK_ROOT_FONT_PX = 16

function readRootFontPx(): number {
  if (typeof document === 'undefined') return FALLBACK_ROOT_FONT_PX
  const px = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(px) && px > 0 ? px : FALLBACK_ROOT_FONT_PX
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(FONT_SIZE_CHANGE_EVENT, onChange)
  return () => window.removeEventListener(FONT_SIZE_CHANGE_EVENT, onChange)
}

/**
 * 루트(html) font-size 를 px 로. 설정의 글자 크기(applyFontSize)가 바뀌면 재렌더된다.
 * Tailwind 의 spacing 단위(rem 기반) 로 잡힌 크기를 px 값이 필요한 곳(react-resizable-panels minSize)에
 * 맞출 때 쓴다.
 */
export function useRootFontSizePx(): number {
  return useSyncExternalStore(subscribe, readRootFontPx, () => FALLBACK_ROOT_FONT_PX)
}

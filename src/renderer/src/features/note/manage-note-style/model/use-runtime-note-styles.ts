/**
 * 노트 스타일 settings 변경 시 `<style id="rally-note-styles">` 를 동적 갱신.
 *
 * - 단일 settings → CSS (light 기본 + `html.dark` override 자동 포함)
 * - app theme 구독 불필요 (`html.dark` 클래스 토글이 브라우저 CSS 규칙으로 자동 적용)
 */
import { useEffect } from 'react'
import { buildNoteStyleCss, useNoteStyle } from '@entities/note-style'

const STYLE_TAG_ID = 'rally-note-styles'

export function useRuntimeNoteStyles(): void {
  const { settings } = useNoteStyle()

  useEffect(() => {
    // attribute selector 2회 chain → (0,2,1) → global.css `.milkdown .ProseMirror h1` 동률 + load order 승리
    const css = buildNoteStyleCss(settings, '[data-rally-note][data-rally-note]')
    let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
    if (!tag) {
      tag = document.createElement('style')
      tag.id = STYLE_TAG_ID
      document.head.appendChild(tag)
    }
    tag.textContent = css
  }, [settings])
}

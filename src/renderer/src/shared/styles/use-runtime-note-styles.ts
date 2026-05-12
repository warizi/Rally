/**
 * 노트 스타일 settings 변경 시 `<style id="rally-note-styles">` 를 동적 갱신.
 *
 * - app root 에 한 번 마운트
 * - theme (light/dark) 구독해 해당 set 만 적용
 */
import { useEffect } from 'react'
import { buildNoteStyleCss, useNoteStyle } from '@entities/note-style'
import { useThemeMode } from '@shared/lib/use-theme-mode'

const STYLE_TAG_ID = 'rally-note-styles'

export function useRuntimeNoteStyles(): void {
  const { settings } = useNoteStyle()
  const mode = useThemeMode()

  useEffect(() => {
    // attribute selector 를 2회 반복해 specificity 를 (0,2,1) 로 끌어올려
    // global.css 의 `.milkdown .ProseMirror h1` (0,2,1) 과 동률 → load order 로 승리.
    const css = buildNoteStyleCss(settings[mode], '[data-rally-note][data-rally-note]')
    let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
    if (!tag) {
      tag = document.createElement('style')
      tag.id = STYLE_TAG_ID
      document.head.appendChild(tag)
    }
    tag.textContent = css
  }, [settings, mode])
}

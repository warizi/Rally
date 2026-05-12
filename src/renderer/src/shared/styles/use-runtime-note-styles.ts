/**
 * 노트 스타일 settings 변경 시 `<style id="rally-note-styles">` 를 동적 갱신.
 *
 * - app root 에 한 번 마운트
 * - theme (light/dark) 구독해 해당 set 만 적용
 * - 컴포넌트 unmount 시 `<style>` 태그 제거
 */
import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { buildNoteStyleCss, useNoteStyle } from '@entities/note-style'

const STYLE_TAG_ID = 'rally-note-styles'

export function useRuntimeNoteStyles(): void {
  const { settings } = useNoteStyle()
  const { resolvedTheme } = useTheme()
  const mode: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light'

  useEffect(() => {
    const css = buildNoteStyleCss(settings[mode])
    let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
    if (!tag) {
      tag = document.createElement('style')
      tag.id = STYLE_TAG_ID
      document.head.appendChild(tag)
    }
    tag.textContent = css

    return () => {
      // 마운트된 동안만 유지. unmount 시 제거하지 않으면 stale CSS 가 남을 수 있음.
      // 앱 root 에서 단 한 번 호출되는 훅이므로 unmount 는 사실상 앱 종료.
    }
  }, [settings, mode])
}

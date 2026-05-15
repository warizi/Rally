/**
 * 노트 색상 mark 의 다크 모드 매핑을 위한 런타임 CSS 주입.
 *
 * floating toolbar 의 팔레트 슬롯을 통해 적용된 mark 는 `data-color-slot="N"`
 * 속성을 가진다. mark 의 inline style 은 라이트 모드 hex (.md 파일 저장값).
 * 다크 모드에서는 이 hook 이 생성한 CSS 규칙이 `!important` 로 그 color 를
 * dark 팔레트 hex 로 override.
 *
 * CSS 구조:
 * ```
 * html.dark [data-rally-note] [data-color-slot="0"] { color: #DARK0 !important; }
 * html.dark [data-rally-note] [data-color-slot="1"] { color: #DARK1 !important; }
 * ...
 * ```
 *
 * 팔레트 변경 시 자동으로 갱신 — useToolbarPalette 구독.
 */
import { useEffect } from 'react'
import { useToolbarPalette } from '../model/use-palette'
import { PALETTE_SLOT_COUNT } from '../model/types'

const STYLE_ELEMENT_ID = 'rally-note-toolbar-colors'

function buildCss(darkColors: readonly string[]): string {
  const rules: string[] = []
  for (let i = 0; i < PALETTE_SLOT_COUNT; i++) {
    const c = darkColors[i]
    if (!c) continue
    rules.push(`html.dark [data-rally-note] [data-color-slot="${i}"] { color: ${c} !important; }`)
  }
  return rules.join('\n')
}

function getOrCreateStyleEl(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ELEMENT_ID
    document.head.appendChild(el)
  }
  return el
}

/**
 * 다크 모드 색상 매핑 CSS 를 `<head>` 에 inject. 팔레트 dark 배열 변경 시 갱신.
 */
export function useRuntimeToolbarColors(): void {
  const { palette, isLoading } = useToolbarPalette()

  useEffect(() => {
    if (isLoading) return
    const el = getOrCreateStyleEl()
    el.textContent = buildCss(palette.dark)
  }, [palette, isLoading])
}

/** 테스트 등 외부에서 직접 CSS 를 만들고 싶을 때 사용. */
export { buildCss as buildToolbarColorsCss }

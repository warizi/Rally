/**
 * NoteStyleSettings → CSS 문자열 변환.
 *
 * - 라이트 (기본): `<root> <element> { font-size; ...; color: light; background-color: light; }`
 * - 다크 (자동 override): `html.dark <root> <element> { color: dark; background-color: dark; }`
 * - codeBlock 은 pre + pre code 듀얼 셀렉터 (텍스트는 둘 다, 배경/마진은 pre 만)
 * - blockquote / hr: 사용자 조절 가능한 border-color / border-width 동적 emit
 * - 시각 속성 (padding / border-radius) 은 실제 노트 (global.css) 와 동일 값 하드코딩
 *
 * - `<root>` 기본값 `[data-rally-note]`. preview / specificity boost 시 변경.
 */
import { ELEMENTS_WITH_BACKGROUND, ELEMENTS_WITH_BORDER } from './types'
import type { ElementStyle, NoteStyleSettings, StyleElementKey } from './types'

/** 요소별 셀렉터 정의. container 가 다른 경우 codeBlock 처럼 분리. */
interface ElementSelectors {
  /** font-size / line-height / color 가 적용되는 셀렉터 */
  text: string
  /** margin / background 가 적용되는 셀렉터. text 와 같으면 단일 rule. */
  container?: string
}

const SELECTORS: Record<StyleElementKey, ElementSelectors> = {
  h1: { text: 'h1' },
  h2: { text: 'h2' },
  h3: { text: 'h3' },
  h4: { text: 'h4' },
  h5: { text: 'h5' },
  h6: { text: 'h6' },
  // 본문은 .ProseMirror 직속 <p> 만 (리스트/blockquote 안의 nested <p> 제외).
  paragraph: { text: '.ProseMirror > p' },
  codeInline: { text: 'code:not(pre code)' },
  // pre 와 CodeMirror 기반 code-block 컴포넌트 모두에 텍스트 스타일.
  // 배경/마진은 pre 또는 .milkdown-code-block 컨테이너에만.
  codeBlock: {
    text: 'pre, pre code, .milkdown-code-block .cm-content, .milkdown-code-block .cm-line',
    container: 'pre, .milkdown-code-block'
  },
  // 인용구는 내부 <p> 까지 텍스트 스타일 확장. 컨테이너는 blockquote 자체.
  blockquote: { text: 'blockquote, blockquote p', container: 'blockquote' },
  hr: { text: 'hr' }
}

/** 요소별 시각 속성 — 사용자 편집 불가, 실제 노트 (global.css) 와 1:1 일치. */
interface ElementDecoration {
  /** dynamic props (color/border-width 등) 보다 먼저 emit 되는 reset 류. */
  resetText?: string[]
  text?: string[]
  textPerMode?: { light: string[]; dark: string[] }
  container?: string[]
  containerPerMode?: { light: string[]; dark: string[] }
}

const DECORATIONS: Partial<Record<StyleElementKey, ElementDecoration>> = {
  codeInline: {
    text: ['padding: 2px 6px', 'border-radius: 4px']
  },
  codeBlock: {
    text: ['padding: 0', 'border-radius: 0'],
    container: ['padding: 8px 12px 10px', 'border-radius: 6px', 'overflow-x: auto']
  },
  blockquote: {
    container: ['padding-left: 12px', 'border-left-style: solid']
  },
  hr: {
    // `border: 0` 은 shorthand 라 이후 등장하는 border-top-* 를 reset 시키므로 dynamic 전에 emit.
    resetText: ['border: 0', 'height: 0'],
    text: ['border-top-style: solid']
  }
}

/** border-side 매핑 — blockquote 는 left, hr 는 top. */
const BORDER_SIDE: Partial<Record<StyleElementKey, 'left' | 'top'>> = {
  blockquote: 'left',
  hr: 'top'
}

function expandSelector(rootSelector: string, elementSelector: string): string {
  return elementSelector
    .split(',')
    .map((s) => `${rootSelector} ${s.trim()}`)
    .join(', ')
}

/** selector list 의 각 항목에 prefix 부여 (`html.dark` 같은 selector 누락 방지). */
function prefixSelectorList(prefix: string, selectorList: string): string {
  return selectorList
    .split(',')
    .map((s) => `${prefix} ${s.trim()}`)
    .join(', ')
}

/** CSS 생성 mode. */
export type BuildMode = 'light' | 'dark' | 'both'

function pushBlock(lines: string[], selector: string, body: string[]): void {
  if (body.length === 0) return
  lines.push(`${selector} {`)
  for (const decl of body) lines.push(`  ${decl};`)
  lines.push(`}`)
}

function ruleFor(
  rootSelector: string,
  element: StyleElementKey,
  style: ElementStyle,
  mode: BuildMode
): string {
  const sels = SELECTORS[element]
  const deco = DECORATIONS[element] ?? {}
  const textSel = expandSelector(rootSelector, sels.text)
  const containerSel = sels.container ? expandSelector(rootSelector, sels.container) : textSel
  const hasSeparateContainer = sels.container !== undefined
  const supportsBg = ELEMENTS_WITH_BACKGROUND.has(element)
  const supportsBorder = ELEMENTS_WITH_BORDER.has(element)
  const borderSide = BORDER_SIDE[element]

  const colorForMode = mode === 'dark' ? style.colorDark : style.colorLight
  const bgForMode = mode === 'dark' ? style.backgroundDark : style.backgroundLight
  const borderColorForMode = mode === 'dark' ? style.borderColorDark : style.borderColorLight
  const perModeKey: 'light' | 'dark' = mode === 'dark' ? 'dark' : 'light'

  const lines: string[] = []

  // 1) 텍스트 rule
  const textBody: string[] = []
  // reset (shorthand 충돌 방지 — border:0 등) 을 dynamic 보다 먼저
  if (deco.resetText) textBody.push(...deco.resetText)
  textBody.push(
    `font-size: ${style.fontSize}`,
    `line-height: ${style.lineHeight}`,
    `color: ${colorForMode}`
  )
  if (!hasSeparateContainer) {
    textBody.push(`margin-top: ${style.marginTop}`, `margin-bottom: ${style.marginBottom}`)
    if (supportsBg) textBody.push(`background-color: ${bgForMode}`)
    if (supportsBorder && borderSide) {
      textBody.push(
        `border-${borderSide}-width: ${style.borderWidth}`,
        `border-${borderSide}-color: ${borderColorForMode}`
      )
    }
  }
  if (deco.text) textBody.push(...deco.text)
  if (deco.textPerMode) textBody.push(...deco.textPerMode[perModeKey])
  pushBlock(lines, textSel, textBody)

  // 2) 컨테이너 rule (codeBlock / blockquote 등)
  if (hasSeparateContainer) {
    const containerBody: string[] = [
      `margin-top: ${style.marginTop}`,
      `margin-bottom: ${style.marginBottom}`
    ]
    if (supportsBg) containerBody.push(`background-color: ${bgForMode}`)
    if (supportsBorder && borderSide) {
      containerBody.push(
        `border-${borderSide}-width: ${style.borderWidth}`,
        `border-${borderSide}-color: ${borderColorForMode}`
      )
    }
    if (deco.container) containerBody.push(...deco.container)
    if (deco.containerPerMode) containerBody.push(...deco.containerPerMode[perModeKey])
    pushBlock(lines, containerSel, containerBody)
  }

  // 3) 다크 variant (mode === 'both' 일 때만)
  if (mode === 'both') {
    const darkTextBody: string[] = [`color: ${style.colorDark}`]
    if (!hasSeparateContainer && supportsBorder && borderSide) {
      darkTextBody.push(`border-${borderSide}-color: ${style.borderColorDark}`)
    }
    if (deco.textPerMode) darkTextBody.push(...deco.textPerMode.dark)
    pushBlock(lines, prefixSelectorList('html.dark', textSel), darkTextBody)

    const darkContainerBody: string[] = []
    if (supportsBg) darkContainerBody.push(`background-color: ${style.backgroundDark}`)
    if (hasSeparateContainer && supportsBorder && borderSide) {
      darkContainerBody.push(`border-${borderSide}-color: ${style.borderColorDark}`)
    }
    if (deco.containerPerMode) darkContainerBody.push(...deco.containerPerMode.dark)
    if (darkContainerBody.length > 0) {
      pushBlock(lines, prefixSelectorList('html.dark', containerSel), darkContainerBody)
    }
  }

  return lines.join('\n')
}

/**
 * `set` 을 CSS 문자열로 변환.
 */
export function buildNoteStyleCss(
  set: NoteStyleSettings,
  rootSelector: string = '[data-rally-note]',
  mode: BuildMode = 'both'
): string {
  return Object.entries(set)
    .map(([key, style]) => ruleFor(rootSelector, key as StyleElementKey, style, mode))
    .join('\n\n')
}

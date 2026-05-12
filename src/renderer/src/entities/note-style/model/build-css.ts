/**
 * NoteStyleSet → CSS 문자열 변환.
 *
 * `[data-rally-note] <selector>` 형태로 specificity 를 확보해 Milkdown 의
 * nord theme 보다 우선 적용되도록 한다. 필요 시 `!important` 추가.
 */
import type { NoteStyleSet, StyleElementKey, ElementStyle } from './types'

const SELECTOR: Record<StyleElementKey, string> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  paragraph: 'p',
  codeInline: 'code:not(pre code)',
  codeBlock: 'pre code',
  blockquote: 'blockquote'
}

function ruleFor(element: StyleElementKey, style: ElementStyle): string {
  const selector = `[data-rally-note] ${SELECTOR[element]}`
  return [
    `${selector} {`,
    `  font-size: ${style.fontSize};`,
    `  line-height: ${style.lineHeight};`,
    `  margin-top: ${style.marginTop};`,
    `  margin-bottom: ${style.marginBottom};`,
    `  color: ${style.color};`,
    `}`
  ].join('\n')
}

export function buildNoteStyleCss(set: NoteStyleSet): string {
  return Object.entries(set)
    .map(([key, style]) => ruleFor(key as StyleElementKey, style))
    .join('\n\n')
}

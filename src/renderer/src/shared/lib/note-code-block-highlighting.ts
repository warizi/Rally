import { basicSetup } from 'codemirror'
import { css } from '@codemirror/lang-css'
import { go } from '@codemirror/lang-go'
import { html } from '@codemirror/lang-html'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { php } from '@codemirror/lang-php'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { sql } from '@codemirror/lang-sql'
import { yaml } from '@codemirror/lang-yaml'
import { HighlightStyle, LanguageDescription, syntaxHighlighting } from '@codemirror/language'
import { indentWithTab } from '@codemirror/commands'
import { Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { codeBlockComponent, codeBlockConfig } from '@milkdown/kit/component/code-block'
import type { Ctx, MilkdownPlugin } from '@milkdown/kit/ctx'

const CHEVRON_DOWN_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
const COPY_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
const SEARCH_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>'
const CLEAR_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

// 색 배치 원칙: 변수·연산자·구두점·괄호는 기본 텍스트색(foreground)으로 두어 산만함을 줄이고,
// 의미가 큰 토큰(키워드·함수·타입·문자열·숫자/상수·주석·프로퍼티)에만 색을 준다. (One Dark / VSCode 류)
const rallyCodeHighlightStyle = HighlightStyle.define([
  // 변수·연산자·구두점·괄호 — 기본 텍스트색으로 고정 (default 하이라이트가 파랗게 칠하는 것 방지)
  {
    tag: [
      tags.variableName,
      tags.definition(tags.variableName),
      tags.local(tags.variableName),
      tags.operator,
      tags.derefOperator,
      tags.punctuation,
      tags.separator,
      tags.bracket,
      tags.squareBracket,
      tags.paren,
      tags.brace,
      tags.content
    ],
    color: 'var(--foreground)'
  },
  // 키워드·제어문·모디파이어 — keyword
  {
    tag: [
      tags.keyword,
      tags.controlKeyword,
      tags.operatorKeyword,
      tags.moduleKeyword,
      tags.modifier
    ],
    color: 'var(--rally-code-keyword)'
  },
  // 함수 정의·호출 — function
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.labelName],
    color: 'var(--rally-code-function)'
  },
  // 타입·클래스·네임스페이스 — type
  {
    tag: [tags.typeName, tags.className, tags.namespace, tags.annotation],
    color: 'var(--rally-code-type)'
  },
  // 숫자·불리언·null/atom·상수 — constant
  {
    tag: [
      tags.number,
      tags.bool,
      tags.atom,
      tags.constant(tags.variableName),
      tags.special(tags.variableName)
    ],
    color: 'var(--rally-code-constant)'
  },
  // 문자열 — string
  {
    tag: [tags.string, tags.special(tags.string), tags.character, tags.inserted],
    color: 'var(--rally-code-string)'
  },
  // 정규식·escape — regexp
  { tag: [tags.regexp, tags.escape], color: 'var(--rally-code-regexp)' },
  // 프로퍼티·속성·태그 — name (소프트)
  {
    tag: [tags.propertyName, tags.attributeName, tags.tagName, tags.angleBracket],
    color: 'var(--rally-code-name)'
  },
  // 주석·메타 — comment (이탤릭)
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.meta, tags.docComment],
    color: 'var(--rally-code-comment)',
    fontStyle: 'italic'
  },
  // 링크·URL — 밑줄
  { tag: [tags.url, tags.link], color: 'var(--rally-code-regexp)', textDecoration: 'underline' },
  // 마크다운 포맷팅
  { tag: tags.heading, fontWeight: '600', color: 'var(--rally-code-heading)' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  // 오류
  { tag: tags.invalid, color: 'var(--rally-code-invalid)' }
])

const rallyCodeEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'inherit',
    fontSize: 'inherit'
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    lineHeight: 'inherit'
  },
  '.cm-content': {
    padding: 0,
    // 캐럿이 구문강조 토큰 색을 따라가지 않도록 일관된 색으로 고정.
    caretColor: 'var(--foreground)'
  },
  // drawSelection() 이 그리는 커스텀 커서 색도 동일하게 고정.
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--foreground)'
  },
  '.cm-line': {
    padding: 0
  },
  '.cm-gutters': {
    display: 'none'
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent'
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklab, var(--primary) 24%, transparent)'
  },
  '&.cm-focused': {
    outline: 'none'
  }
})

const rallyCodeLanguages: LanguageDescription[] = [
  LanguageDescription.of({
    name: 'JavaScript',
    alias: ['js', 'jsx', 'mjs', 'cjs'],
    extensions: ['js', 'jsx', 'mjs', 'cjs'],
    load: async () => javascript({ jsx: true })
  }),
  LanguageDescription.of({
    name: 'TypeScript',
    alias: ['ts', 'tsx'],
    extensions: ['ts', 'tsx'],
    load: async () => javascript({ typescript: true, jsx: true })
  }),
  LanguageDescription.of({
    name: 'JSON',
    alias: ['jsonc'],
    extensions: ['json', 'jsonc'],
    load: async () => json()
  }),
  LanguageDescription.of({
    name: 'CSS',
    alias: ['css'],
    extensions: ['css'],
    load: async () => css()
  }),
  LanguageDescription.of({
    name: 'HTML',
    alias: ['html', 'xml'],
    extensions: ['html', 'htm', 'xml'],
    load: async () => html()
  }),
  LanguageDescription.of({
    name: 'Markdown',
    alias: ['md', 'markdown'],
    extensions: ['md', 'markdown'],
    load: async () => markdown()
  }),
  LanguageDescription.of({
    name: 'Python',
    alias: ['py', 'python'],
    extensions: ['py'],
    load: async () => python()
  }),
  LanguageDescription.of({
    name: 'Rust',
    alias: ['rs', 'rust'],
    extensions: ['rs'],
    load: async () => rust()
  }),
  LanguageDescription.of({
    name: 'Go',
    alias: ['go', 'golang'],
    extensions: ['go'],
    load: async () => go()
  }),
  LanguageDescription.of({
    name: 'Java',
    alias: ['java'],
    extensions: ['java'],
    load: async () => java()
  }),
  LanguageDescription.of({
    name: 'PHP',
    alias: ['php'],
    extensions: ['php'],
    load: async () => php()
  }),
  LanguageDescription.of({
    name: 'SQL',
    alias: ['sql'],
    extensions: ['sql'],
    load: async () => sql()
  }),
  LanguageDescription.of({
    name: 'YAML',
    alias: ['yaml', 'yml'],
    extensions: ['yaml', 'yml'],
    load: async () => yaml()
  })
]

export const rallyCodeBlockPlugins: MilkdownPlugin[] = codeBlockComponent

export function configureRallyCodeBlock(ctx: Ctx): void {
  ctx.update(codeBlockConfig.key, (defaultConfig) => ({
    ...defaultConfig,
    extensions: [
      basicSetup,
      rallyCodeEditorTheme,
      // Tab/Shift-Tab 으로 들여쓰기 (CodeMirror 기본은 Tab=포커스 이동). milkdown 보다 먼저 처리하도록 우선순위 높임.
      Prec.highest(keymap.of([indentWithTab])),
      // basicSetup 의 defaultHighlightStyle 을 이기도록 최우선 순위로. (fallback 이면 적용 안 됨)
      Prec.highest(syntaxHighlighting(rallyCodeHighlightStyle))
    ],
    languages: rallyCodeLanguages,
    searchPlaceholder: '언어 검색',
    noResultText: '결과 없음',
    copyText: '',
    expandIcon: CHEVRON_DOWN_ICON,
    searchIcon: SEARCH_ICON,
    clearSearchIcon: CLEAR_ICON,
    copyIcon: COPY_ICON,
    previewOnlyByDefault: false
  }))
}

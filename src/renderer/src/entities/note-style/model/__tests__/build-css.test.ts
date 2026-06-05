/**
 * buildNoteStyleCss 단위 테스트.
 */
import { describe, it, expect } from 'vitest'
import { buildNoteStyleCss } from '../build-css'
import { DEFAULT_NOTE_STYLE_SETTINGS } from '../defaults'

describe('buildNoteStyleCss', () => {
  const css = buildNoteStyleCss(DEFAULT_NOTE_STYLE_SETTINGS)

  it('각 요소가 [data-rally-note] selector 사용', () => {
    expect(css).toMatch(/\[data-rally-note\]\s+h1\s*\{/)
    expect(css).toMatch(/\[data-rally-note\]\s+blockquote\s*\{/)
  })

  it('본문 paragraph 는 .ProseMirror > p 로 한정 (nested <p> 제외)', () => {
    expect(css).toMatch(/\[data-rally-note\]\s+\.ProseMirror\s*>\s*p\s*\{/)
  })

  it('codeInline 은 :not(pre code) 로 codeBlock 과 구분', () => {
    expect(css).toMatch(/\[data-rally-note\]\s+code:not\(pre code\)/)
  })

  it('codeBlock 은 pre 와 CodeMirror 컴포넌트 selector 를 함께 사용', () => {
    expect(css).toMatch(/\[data-rally-note\]\s+pre,\s*\[data-rally-note\]\s+pre code/)
    expect(css).toMatch(/\[data-rally-note\]\s+\.milkdown-code-block\s+\.cm-content/)
    expect(css).toMatch(/\[data-rally-note\]\s+\.milkdown-code-block\s*\{/)
  })

  it('h1 라이트 rule 에 font-size / line-height / color 포함', () => {
    const m = css.match(/\[data-rally-note\] h1 \{([\s\S]*?)\}/)
    expect(m).not.toBeNull()
    const body = m![1]
    expect(body).toMatch(/font-size:/)
    expect(body).toMatch(/line-height:/)
    expect(body).toMatch(/color:\s*#/)
  })

  it('codeInline / codeBlock 의 라이트 rule 에 background-color 포함', () => {
    expect(css).toMatch(/code:not\(pre code\) \{[\s\S]*?background-color:/)
    // codeBlock 의 pre 컨테이너 rule
    const preBlockMatch = css.match(
      /\[data-rally-note\] pre, \[data-rally-note\] \.milkdown-code-block \{([\s\S]*?)\}/
    )
    expect(preBlockMatch).not.toBeNull()
    expect(preBlockMatch![1]).toMatch(/background-color:/)
  })

  it('h1 / paragraph 는 background-color 가 transparent', () => {
    const h1 = css.match(/\[data-rally-note\] h1 \{([\s\S]*?)\}/)![1]
    // h1 등 bg 미지원 요소는 background-color 자체를 emit 하지 않음
    expect(h1).not.toMatch(/background-color:/)
  })

  it('codeInline 에 시각 속성 (padding 2px 6px, border-radius 4px)', () => {
    const m = css.match(/\[data-rally-note\] code:not\(pre code\) \{([\s\S]*?)\}/)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/padding:\s*2px 6px/)
    expect(m![1]).toMatch(/border-radius:\s*4px/)
  })

  it('codeBlock pre 컨테이너에 시각 속성 (padding 8px 12px 10px, border-radius 6px, overflow-x auto, max-width 100%)', () => {
    const m = css.match(
      /\[data-rally-note\] pre, \[data-rally-note\] \.milkdown-code-block \{([\s\S]*?)\}/
    )
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/padding:\s*8px 12px 10px/)
    expect(m![1]).toMatch(/border-radius:\s*6px/)
    expect(m![1]).toMatch(/overflow-x:\s*auto/)
    // 긴 한 줄 코드가 노트 너비를 밀지 않도록 max-width 제한.
    expect(m![1]).toMatch(/max-width:\s*100%/)
  })

  it('codeBlock pre code 텍스트 rule 은 padding/border-radius 0 (내부 코드)', () => {
    const m = css.match(
      /\[data-rally-note\] pre, \[data-rally-note\] pre code, \[data-rally-note\] \.milkdown-code-block \.cm-content, \[data-rally-note\] \.milkdown-code-block \.cm-line \{([\s\S]*?)\}/
    )
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/padding:\s*0/)
    expect(m![1]).toMatch(/border-radius:\s*0/)
  })

  it('blockquote 텍스트 셀렉터는 blockquote + blockquote p (내부 <p> 색상 덮어쓰기)', () => {
    expect(css).toMatch(/\[data-rally-note\]\s+blockquote,\s*\[data-rally-note\]\s+blockquote p/)
  })

  it('html.dark prefix 는 selector list 의 각 항목에 모두 적용', () => {
    // dark variant 의 blockquote 텍스트 rule: html.dark blockquote, html.dark blockquote p
    expect(css).toMatch(
      /html\.dark\s+\[data-rally-note\]\s+blockquote,\s*html\.dark\s+\[data-rally-note\]\s+blockquote p/
    )
    // codeBlock 도 동일 (pre, pre code 둘 다에 html.dark prefix)
    expect(css).toMatch(
      /html\.dark\s+\[data-rally-note\]\s+pre,\s*html\.dark\s+\[data-rally-note\]\s+pre code/
    )
  })

  it('blockquote 컨테이너 rule 에 border-left + padding-left + mode 별 border-left-color (사용자 조절)', () => {
    const m = css.match(/(?<!,\s)\[data-rally-note\] blockquote \{([\s\S]*?)\}/)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/padding-left:\s*12px/)
    expect(m![1]).toMatch(/border-left-width:\s*3px/) // default
    expect(m![1]).toMatch(/border-left-color:\s*#4b5563/) // LIGHT_MUTED

    const dark = css.match(/html\.dark \[data-rally-note\] blockquote \{([\s\S]*?)\}/)
    expect(dark).not.toBeNull()
    expect(dark![1]).toMatch(/border-left-color:\s*#9ca3af/) // DARK_MUTED
  })

  it('hr rule 에 border-top + 사용자 조절 가능한 색상/굵기', () => {
    const m = css.match(/\[data-rally-note\] hr \{([\s\S]*?)\}/)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/border-top-width:\s*1px/) // default
    expect(m![1]).toMatch(/border-top-color:\s*#e5e7eb/) // LIGHT_BORDER
    expect(m![1]).toMatch(/border-top-style:\s*solid/)

    const dark = css.match(/html\.dark \[data-rally-note\] hr \{([\s\S]*?)\}/)
    expect(dark).not.toBeNull()
    expect(dark![1]).toMatch(/border-top-color:\s*#374151/) // DARK_BORDER
  })

  it('hr 의 resetText (border: 0) 가 dynamic border-top 보다 먼저 emit', () => {
    const m = css.match(/\[data-rally-note\] hr \{([\s\S]*?)\}/)
    expect(m).not.toBeNull()
    const body = m![1]
    const resetIdx = body.indexOf('border: 0')
    const dynamicIdx = body.indexOf('border-top-width')
    expect(resetIdx).toBeGreaterThanOrEqual(0)
    expect(dynamicIdx).toBeGreaterThan(resetIdx)
  })

  it('각 요소마다 html.dark variant 자동 생성 (color 만, bg 는 지원 요소에 한해)', () => {
    expect(css).toMatch(/html\.dark\s+\[data-rally-note\]\s+h1\s*\{/)
    const m = css.match(/html\.dark \[data-rally-note\] h1 \{([\s\S]*?)\}/)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/color:\s*#/)
    expect(m![1]).not.toMatch(/font-size:/) // 다크 override 는 color/bg 만

    // codeInline 다크 variant 에 bg 도 포함
    const codeDarkBg = css.match(
      /html\.dark \[data-rally-note\] code:not\(pre code\) \{([\s\S]*?)\}/
    )
    expect(codeDarkBg).not.toBeNull()
  })

  it('rootSelector 인자로 다른 selector 사용 가능 (preview / specificity boost)', () => {
    const previewCss = buildNoteStyleCss(DEFAULT_NOTE_STYLE_SETTINGS, '[data-rally-note-preview]')
    expect(previewCss).toMatch(/\[data-rally-note-preview\]\s+h1\s*\{/)
    expect(previewCss).toMatch(/html\.dark\s+\[data-rally-note-preview\]\s+h1\s*\{/)

    const boostedCss = buildNoteStyleCss(
      DEFAULT_NOTE_STYLE_SETTINGS,
      '[data-rally-note][data-rally-note]'
    )
    expect(boostedCss).toMatch(/\[data-rally-note\]\[data-rally-note\]\s+h1\s*\{/)
  })

  it("mode='light' → html.dark variant 생략, 색상은 colorLight 사용", () => {
    const lightCss = buildNoteStyleCss(DEFAULT_NOTE_STYLE_SETTINGS, '[data-rally-note]', 'light')
    expect(lightCss).not.toMatch(/html\.dark/)
    const m = lightCss.match(/\[data-rally-note\] h1 \{([\s\S]*?)\}/)
    expect(m).not.toBeNull()
    expect(m![1]).toContain(`color: ${DEFAULT_NOTE_STYLE_SETTINGS.h1.colorLight}`)
  })

  it("mode='dark' → html.dark variant 생략, 색상은 colorDark, bg 도 dark 값", () => {
    const darkCss = buildNoteStyleCss(DEFAULT_NOTE_STYLE_SETTINGS, '[data-rally-note]', 'dark')
    expect(darkCss).not.toMatch(/html\.dark/)
    const m = darkCss.match(/\[data-rally-note\] h1 \{([\s\S]*?)\}/)
    expect(m).not.toBeNull()
    expect(m![1]).toContain(`color: ${DEFAULT_NOTE_STYLE_SETTINGS.h1.colorDark}`)
    // codeInline 에 dark bg
    const code = darkCss.match(/\[data-rally-note\] code:not\(pre code\) \{([\s\S]*?)\}/)![1]
    expect(code).toContain(
      `background-color: ${DEFAULT_NOTE_STYLE_SETTINGS.codeInline.backgroundDark}`
    )
  })
})

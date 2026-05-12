/**
 * buildNoteStyleCss 단위 테스트 (Phase 1).
 */
import { describe, it, expect } from 'vitest'
import { buildNoteStyleCss } from '../build-css'
import { DEFAULT_NOTE_STYLE_LIGHT } from '../defaults'

describe('buildNoteStyleCss', () => {
  const css = buildNoteStyleCss(DEFAULT_NOTE_STYLE_LIGHT)

  it('각 요소가 [data-rally-note] selector 사용', () => {
    expect(css).toMatch(/\[data-rally-note\]\s+h1\s*\{/)
    expect(css).toMatch(/\[data-rally-note\]\s+p\s*\{/)
    expect(css).toMatch(/\[data-rally-note\]\s+blockquote\s*\{/)
  })

  it('codeInline 은 :not(pre code) 로 codeBlock 과 구분', () => {
    expect(css).toMatch(/\[data-rally-note\]\s+code:not\(pre code\)/)
    expect(css).toMatch(/\[data-rally-note\]\s+pre code/)
  })

  it('각 rule 에 5속성 포함', () => {
    const h1Match = css.match(/\[data-rally-note\] h1 \{([\s\S]*?)\}/)
    expect(h1Match).not.toBeNull()
    const h1Body = h1Match![1]
    expect(h1Body).toMatch(/font-size:/)
    expect(h1Body).toMatch(/line-height:/)
    expect(h1Body).toMatch(/margin-top:/)
    expect(h1Body).toMatch(/margin-bottom:/)
    expect(h1Body).toMatch(/color:/)
  })

  it('10개 요소 모두에 대해 rule 생성', () => {
    // selector 발생 횟수: h1~h6, p, code:not, pre code, blockquote = 10
    const ruleCount = (css.match(/\[data-rally-note\]/g) ?? []).length
    expect(ruleCount).toBe(10)
  })

  it('rootSelector 인자로 다른 selector 사용 가능 (preview / specificity boost)', () => {
    const previewCss = buildNoteStyleCss(DEFAULT_NOTE_STYLE_LIGHT, '[data-rally-note-preview]')
    expect(previewCss).toMatch(/\[data-rally-note-preview\]\s+h1\s*\{/)
    expect(previewCss).not.toMatch(/\[data-rally-note\]\s/)

    const boostedCss = buildNoteStyleCss(
      DEFAULT_NOTE_STYLE_LIGHT,
      '[data-rally-note][data-rally-note]'
    )
    // attribute 가 2회 — global.css 의 `.milkdown .ProseMirror h1` 와 specificity 동률
    expect(boostedCss).toMatch(/\[data-rally-note\]\[data-rally-note\]\s+h1\s*\{/)
  })
})

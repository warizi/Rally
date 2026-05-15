/**
 * note-color-mark 단위 테스트.
 *
 * Milkdown 통합 (ProseMirror schema) 은 DOM 환경 의존이라 여기서 다루지 않고,
 * 순수 remark 파이프라인 (parse → 커스텀 플러그인 → stringify) 의 라운드트립과
 * `colorSpanRemarkPlugin` 의 페어링 동작을 검증.
 */
import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify, { type Options as StringifyOptions } from 'remark-stringify'
import type { Root } from 'mdast'
import {
  colorSpanRemarkPlugin,
  colorSpanStringifyHandler,
  COLOR_SPAN_MDAST_TYPE
} from '../note-color-mark'

// 커스텀 mdast 타입(colorSpan)을 handlers 에 추가 — Handlers 표준 타입에는
// 표준 mdast 노드 키만 있으므로 type assertion 으로 우회.
const stringifyOptions = {
  handlers: { [COLOR_SPAN_MDAST_TYPE]: colorSpanStringifyHandler }
} as unknown as StringifyOptions

// unified().use() 체인의 정확한 Processor 타입은 .use 마다 변형되므로 inference 에 위임.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeProcessor() {
  return unified()
    .use(remarkParse)
    .use(colorSpanRemarkPlugin)
    .use(remarkStringify, stringifyOptions)
}

function parseAndRun(md: string): Root {
  const proc = makeProcessor()
  const tree = proc.parse(md) as Root
  proc.runSync(tree)
  return tree
}

function roundtrip(md: string): string {
  const proc = makeProcessor()
  const tree = proc.parse(md) as Root
  proc.runSync(tree)
  return String(proc.stringify(tree)).trim()
}

describe('colorSpanRemarkPlugin', () => {
  it('단순 paired span 을 colorSpan 노드로 감싼다', () => {
    const tree = parseAndRun('hello <span style="color:#ff0000">red</span> world')
    const para = tree.children[0]
    expect(para.type).toBe('paragraph')
    // children: [text "hello ", colorSpan, text " world"]
    expect('children' in para && para.children).toHaveLength(3)
    if ('children' in para) {
      const cs = para.children[1] as unknown as { type: string; color: string; children: unknown[] }
      expect(cs.type).toBe('colorSpan')
      expect(cs.color).toBe('#ff0000')
      expect(cs.children).toHaveLength(1)
    }
  })

  it('한 단락에 여러 paired span', () => {
    const tree = parseAndRun(
      '<span style="color:#111111">A</span> mid <span style="color:#222222">B</span>'
    )
    const para = tree.children[0]
    if ('children' in para) {
      const colorSpans = para.children.filter((c) => (c as { type?: string }).type === 'colorSpan')
      expect(colorSpans).toHaveLength(2)
      expect((colorSpans[0] as unknown as { color: string }).color).toBe('#111111')
      expect((colorSpans[1] as unknown as { color: string }).color).toBe('#222222')
    }
  })

  it('닫는 태그 없는 unpaired span 은 그대로 둔다', () => {
    const tree = parseAndRun('hello <span style="color:#ff0000">red without close')
    const para = tree.children[0]
    if ('children' in para) {
      // colorSpan 없어야 함
      const colorSpans = para.children.filter((c) => (c as { type?: string }).type === 'colorSpan')
      expect(colorSpans).toHaveLength(0)
    }
  })

  it('color CSS 가 없는 일반 span 은 무시 (수정 안 함)', () => {
    const tree = parseAndRun('<span class="x">normal</span>')
    const para = tree.children[0]
    if ('children' in para) {
      const colorSpans = para.children.filter((c) => (c as { type?: string }).type === 'colorSpan')
      expect(colorSpans).toHaveLength(0)
    }
  })

  it('중첩된 paired span 도 양쪽 다 페어링', () => {
    const tree = parseAndRun(
      '<span style="color:#ff0000">outer <span style="color:#0000ff">inner</span> back</span>'
    )
    const para = tree.children[0]
    if ('children' in para) {
      const outer = para.children[0] as unknown as {
        type: string
        color: string
        children: unknown[]
      }
      expect(outer.type).toBe('colorSpan')
      expect(outer.color).toBe('#ff0000')
      // outer.children 안에 inner colorSpan
      const innerColorSpans = outer.children.filter(
        (c) => (c as { type?: string }).type === 'colorSpan'
      )
      expect(innerColorSpans).toHaveLength(1)
      expect((innerColorSpans[0] as unknown as { color: string }).color).toBe('#0000ff')
    }
  })

  it('다양한 색상 표기 (단축 hex, rgb, 이름) 도 페어링', () => {
    const cases = [
      ['<span style="color:#f00">x</span>', '#f00'],
      ['<span style="color: rgb(255,0,0)">x</span>', 'rgb(255,0,0)'],
      ['<span style="color:red">x</span>', 'red'],
      ["<span style='color:#abc'>x</span>", '#abc']
    ]
    for (const [md, expectedColor] of cases) {
      const tree = parseAndRun(md)
      const para = tree.children[0]
      if ('children' in para) {
        const cs = para.children.find(
          (c) => (c as { type?: string }).type === 'colorSpan'
        ) as unknown as { color: string } | undefined
        expect(cs, `input: ${md}`).toBeDefined()
        expect(cs?.color).toBe(expectedColor)
      }
    }
  })
})

describe('round-trip', () => {
  it('단순 paired span 라운드트립', () => {
    const md = 'hello <span style="color:#ff0000">red</span> world'
    expect(roundtrip(md)).toContain('<span style="color:#ff0000">red</span>')
  })

  it('span 내부 bold 마크 보존', () => {
    const md = 'try <span style="color:#ff0000">**red bold**</span> text'
    const out = roundtrip(md)
    expect(out).toContain('<span style="color:#ff0000">')
    expect(out).toContain('</span>')
    expect(out).toContain('**red bold**')
  })

  it('헤딩 안의 paired span 도 라운드트립', () => {
    const md = '# Title with <span style="color:#0000ff">blue</span> word'
    const out = roundtrip(md)
    expect(out).toContain('# Title with')
    expect(out).toContain('<span style="color:#0000ff">blue</span>')
  })

  it('color CSS 가 없는 일반 span 은 그대로 유지', () => {
    const md = '<span class="x">plain</span>'
    const out = roundtrip(md)
    // class 가 있는 span 은 별도 처리 없이 raw html 노드로 통과
    expect(out).toContain('<span class="x">')
  })
})

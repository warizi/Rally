/**
 * note-embed-schema 단위 테스트.
 *
 * remark 파이프라인 (parse → rallyEmbedRemarkPlugin → stringify) 라운드트립.
 * Milkdown ProseMirror 통합은 DOM 의존이라 제외.
 */
import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify, { type Options as StringifyOptions } from 'remark-stringify'
import type { Root } from 'mdast'
import {
  rallyEmbedRemarkPlugin,
  rallyEmbedStringifyHandler,
  RALLY_EMBED_MDAST_TYPE
} from '../note-embed-schema'

/** custom node 타입 (mdast PhrasingContent 에 없어 unknown 경유). */
type AnyChild = { type: string } & Record<string, unknown>
function asAny(children: readonly unknown[]): AnyChild[] {
  return children as AnyChild[]
}

const stringifyOptions = {
  handlers: { [RALLY_EMBED_MDAST_TYPE]: rallyEmbedStringifyHandler }
} as unknown as StringifyOptions

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeProcessor() {
  return unified()
    .use(remarkParse)
    .use(rallyEmbedRemarkPlugin)
    .use(remarkStringify, stringifyOptions)
}

function parseAndRun(md: string): Root {
  const proc = makeProcessor()
  const tree = proc.parse(md) as Root
  proc.runSync(tree)
  return tree
}

function roundtrip(md: string): string {
  return String(makeProcessor().processSync(md)).trim()
}

describe('rallyEmbedRemarkPlugin', () => {
  it('extracts single embed in paragraph text', () => {
    const tree = parseAndRun('before ![[csv:abc|h=400]] after')
    const para = tree.children[0]
    expect(para.type).toBe('paragraph')
    if (para.type !== 'paragraph') return
    expect(para.children).toHaveLength(3)
    expect(para.children[0]).toEqual({ type: 'text', value: 'before ' })
    expect(para.children[1]).toMatchObject({
      type: RALLY_EMBED_MDAST_TYPE,
      domain: 'csv',
      entityId: 'abc',
      height: 400
    })
    expect(para.children[2]).toEqual({ type: 'text', value: ' after' })
  })

  it('recognizes all 4 domains', () => {
    for (const domain of ['note', 'csv', 'pdf', 'image'] as const) {
      const tree = parseAndRun(`![[${domain}:id123]]`)
      const para = tree.children[0]
      if (para.type !== 'paragraph') throw new Error('expected paragraph')
      const embed = asAny(para.children).find((c) => c.type === RALLY_EMBED_MDAST_TYPE)
      expect(embed).toMatchObject({
        type: RALLY_EMBED_MDAST_TYPE,
        domain,
        entityId: 'id123'
      })
    }
  })

  it('handles embeds without h meta (height undefined)', () => {
    const tree = parseAndRun('![[note:abc]]')
    const para = tree.children[0]
    if (para.type !== 'paragraph') throw new Error('expected paragraph')
    const embed = asAny(para.children).find((c) => c.type === RALLY_EMBED_MDAST_TYPE)
    expect(embed).toMatchObject({ domain: 'note', entityId: 'abc' })
    expect(embed?.height).toBeUndefined()
  })

  it('extracts multiple embeds in one paragraph', () => {
    const tree = parseAndRun('![[csv:a|h=200]] middle ![[pdf:b|h=600]]')
    const para = tree.children[0]
    if (para.type !== 'paragraph') throw new Error('expected paragraph')
    const embeds = asAny(para.children).filter((c) => c.type === RALLY_EMBED_MDAST_TYPE)
    expect(embeds).toHaveLength(2)
    expect(embeds[0]).toMatchObject({ domain: 'csv', entityId: 'a', height: 200 })
    expect(embeds[1]).toMatchObject({ domain: 'pdf', entityId: 'b', height: 600 })
  })

  it('ignores unknown domains', () => {
    const tree = parseAndRun('![[foo:bar]]')
    const para = tree.children[0]
    if (para.type !== 'paragraph') throw new Error('expected paragraph')
    const embeds = asAny(para.children).filter((c) => c.type === RALLY_EMBED_MDAST_TYPE)
    expect(embeds).toHaveLength(0)
  })

  it('leaves text without embeds unchanged', () => {
    const tree = parseAndRun('hello world ![regular](image.png)')
    const para = tree.children[0]
    if (para.type !== 'paragraph') throw new Error('expected paragraph')
    expect(asAny(para.children).some((c) => c.type === RALLY_EMBED_MDAST_TYPE)).toBe(false)
  })

  it('ignores h=0 / h with non-numeric (height undefined)', () => {
    // h=0 은 invalid → height 미설정. 패턴 자체는 매칭됨.
    const tree = parseAndRun('![[csv:abc|h=0]]')
    const para = tree.children[0]
    if (para.type !== 'paragraph') throw new Error('expected paragraph')
    const embed = asAny(para.children).find((c) => c.type === RALLY_EMBED_MDAST_TYPE)
    expect(embed).toMatchObject({ domain: 'csv', entityId: 'abc' })
    expect(embed?.height).toBeUndefined()
  })
})

describe('rallyEmbedStringifyHandler — round-trip', () => {
  it('preserves embed with height', () => {
    expect(roundtrip('![[csv:abc|h=400]]')).toBe('![[csv:abc|h=400]]')
  })

  it('preserves embed without height', () => {
    expect(roundtrip('![[note:xyz]]')).toBe('![[note:xyz]]')
  })

  it('preserves text + embed + text', () => {
    expect(roundtrip('before ![[pdf:p1|h=600]] after')).toBe('before ![[pdf:p1|h=600]] after')
  })

  it('preserves multiple embeds across all domains', () => {
    const md = 'a ![[note:n]] b ![[csv:c|h=200]] c ![[pdf:p|h=600]] d ![[image:i|h=400]] e'
    expect(roundtrip(md)).toBe(md)
  })

  it('preserves embed in a paragraph after a heading', () => {
    const md = ['# 제목', '', '본문 ![[csv:abc|h=300]] 끝.'].join('\n')
    expect(roundtrip(md)).toBe(md)
  })

  it('preserves consecutive embeds (no text between)', () => {
    const md = '![[csv:a]]![[pdf:b|h=400]]'
    expect(roundtrip(md)).toBe(md)
  })

  it('preserves embed in list item', () => {
    const md = ['* 항목 1 ![[note:abc]]', '* 항목 2 ![[csv:xyz|h=200]]'].join('\n')
    // remark-stringify 기본 list bullet '*'
    expect(roundtrip(md)).toBe(md)
  })
})

describe('rallyEmbedRemarkPlugin (추가 분기)', () => {
  it('entity ID 안 trim 처리 (앞뒤 공백 제거)', () => {
    const tree = parseAndRun('![[note:  abc-id  ]]')
    const para = tree.children[0]
    if (para.type !== 'paragraph') throw new Error('expected paragraph')
    const embed = asAny(para.children).find((c) => c.type === RALLY_EMBED_MDAST_TYPE)
    expect(embed?.entityId).toBe('abc-id')
  })

  it('h=-5 (음수 → 매칭 안 됨, height 미설정)', () => {
    // 정규식 (\d+) 는 negative 부호 매칭 안 됨 → 전체 패턴이 매칭 안 됨
    const tree = parseAndRun('![[note:abc|h=-5]]')
    const para = tree.children[0]
    if (para.type !== 'paragraph') throw new Error('expected paragraph')
    const embeds = asAny(para.children).filter((c) => c.type === RALLY_EMBED_MDAST_TYPE)
    expect(embeds.length).toBe(0)
  })

  it('paragraph 가 아닌 텍스트 안 embed (heading) → 처리됨', () => {
    const tree = parseAndRun('# 제목 ![[note:abc]]')
    const heading = tree.children[0]
    if (heading.type !== 'heading') throw new Error('expected heading')
    const embed = asAny(heading.children).find((c) => c.type === RALLY_EMBED_MDAST_TYPE)
    expect(embed).toMatchObject({ domain: 'note', entityId: 'abc' })
  })

  it('한 단락에 동일 domain 3개 → 3개 모두 매칭', () => {
    const tree = parseAndRun('![[note:a]] ![[note:b]] ![[note:c]]')
    const para = tree.children[0]
    if (para.type !== 'paragraph') throw new Error('expected paragraph')
    const embeds = asAny(para.children).filter((c) => c.type === RALLY_EMBED_MDAST_TYPE)
    expect(embeds.length).toBe(3)
    expect(embeds.map((e) => e.entityId)).toEqual(['a', 'b', 'c'])
  })

  it('text 시작 위치 embed → 앞에 빈 text 노드 추가 안 함', () => {
    const tree = parseAndRun('![[csv:start]] text after')
    const para = tree.children[0]
    if (para.type !== 'paragraph') throw new Error('expected paragraph')
    // 시작 위치 embed → 빈 text 노드는 안 들어감
    expect(para.children[0].type).toBe(RALLY_EMBED_MDAST_TYPE)
  })
})

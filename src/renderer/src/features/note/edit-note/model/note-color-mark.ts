/**
 * 노트 텍스트 색상 Milkdown mark — `<span style="color:#xxx">text</span>` 라운드트립.
 *
 * 구조:
 * 1) remark 플러그인 (`colorSpanRemarkPlugin`) — 파싱된 mdast 의 paired html span 노드를
 *    커스텀 `colorSpan` mdast 노드로 wrapping
 * 2) Milkdown `colorMarkSchema` — ProseMirror mark schema (attrs: color hex 만).
 *    parseMarkdown 은 `colorSpan` mdast 노드 매칭, toMarkdown 은 `state.withMark`
 *    으로 `colorSpan` 출력
 * 3) remark-stringify 핸들러 (`colorSpanStringifyHandler`) — `colorSpan` mdast 노드를
 *    raw HTML `<span style="color:#xxx">...</span>` 으로 직렬화
 *
 * 다크 모드 매핑, slot 인덱스, palette 동기화 모두 없음 — 단순히 적용 시점의
 * hex 그대로 저장/표시.
 */
import { $markSchema } from '@milkdown/kit/utils'
import { visit } from 'unist-util-visit'
import type { Root, RootContent, PhrasingContent } from 'mdast'
import type { Handle } from 'mdast-util-to-markdown'

export const COLOR_MARK_NAME = 'colorMark'
export const COLOR_SPAN_MDAST_TYPE = 'colorSpan'

/** color span 의 시작 html 토큰 매칭. 캡처 그룹 1 = 색상값 (hex / rgb / 이름). */
const OPEN_SPAN_COLOR_RE = /color\s*:\s*([^;"'>]+?)\s*(?:;|["']|$)/i

function matchOpenColorSpan(value: string): string | null {
  const trimmed = value.trim()
  if (!/^<span\s+/i.test(trimmed)) return null
  if (!trimmed.endsWith('>')) return null
  if (trimmed.startsWith('</')) return null
  const colorM = OPEN_SPAN_COLOR_RE.exec(trimmed)
  if (!colorM) return null
  return colorM[1].trim()
}

const CLOSE_SPAN_RE = /^<\/span\s*>$/i
function isCloseColorSpan(value: string): boolean {
  return CLOSE_SPAN_RE.test(value.trim())
}

function pairColorSpansInChildren<T extends { children?: unknown[] }>(parent: T): void {
  const children = parent.children as PhrasingContent[] | undefined
  if (!Array.isArray(children)) return

  const out: PhrasingContent[] = []
  let i = 0
  while (i < children.length) {
    const node = children[i]
    if (node.type === 'html') {
      const color = matchOpenColorSpan(node.value)
      if (color) {
        let depth = 1
        let closeIdx = -1
        for (let j = i + 1; j < children.length; j++) {
          const candidate = children[j]
          if (candidate.type !== 'html') continue
          if (matchOpenColorSpan(candidate.value)) {
            depth++
          } else if (isCloseColorSpan(candidate.value)) {
            depth--
            if (depth === 0) {
              closeIdx = j
              break
            }
          }
        }
        if (closeIdx !== -1) {
          const innerChildren = children.slice(i + 1, closeIdx) as PhrasingContent[]
          const wrapper = {
            type: COLOR_SPAN_MDAST_TYPE,
            color,
            children: innerChildren
          }
          pairColorSpansInChildren(wrapper as unknown as { children?: unknown[] })
          out.push(wrapper as unknown as PhrasingContent)
          i = closeIdx + 1
          continue
        }
      }
    }
    out.push(node)
    i++
  }
  ;(parent as unknown as { children: PhrasingContent[] }).children = out
}

export function colorSpanRemarkPlugin() {
  return (tree: Root): void => {
    visit(tree, (node) => {
      if ('children' in node && Array.isArray((node as { children: unknown[] }).children)) {
        pairColorSpansInChildren(node as RootContent & { children: unknown[] })
      }
    })
  }
}

export const colorSpanStringifyHandler: Handle = (node, _parent, state, info) => {
  const colorNode = node as unknown as {
    color: string
    children: PhrasingContent[]
  }
  const inner = state.containerPhrasing(
    colorNode as unknown as Parameters<typeof state.containerPhrasing>[0],
    info
  )
  return `<span style="color:${colorNode.color}">${inner}</span>`
}

export const colorMarkSchema = $markSchema(COLOR_MARK_NAME, () => ({
  attrs: {
    color: { default: '#000000', validate: 'string' }
  },
  inclusive: true,
  parseDOM: [
    {
      tag: 'span[style]',
      getAttrs: (dom: HTMLElement | string) => {
        if (typeof dom === 'string') return false
        const style = dom.getAttribute('style') ?? ''
        const m = /color\s*:\s*([^;]+)/i.exec(style)
        if (!m) return false
        return { color: m[1].trim() }
      }
    }
  ],
  toDOM: (mark) => ['span', { style: `color: ${mark.attrs.color as string}` }, 0],
  parseMarkdown: {
    match: (node) => node.type === COLOR_SPAN_MDAST_TYPE,
    runner: (state, node, markType) => {
      const data = node as unknown as { color: string }
      state.openMark(markType, { color: data.color })
      const children = (node as unknown as { children: unknown }).children
      state.next(children as Parameters<typeof state.next>[0])
      state.closeMark(markType)
    }
  },
  toMarkdown: {
    match: (mark) => mark.type.name === COLOR_MARK_NAME,
    runner: (state, mark) => {
      state.withMark(mark, COLOR_SPAN_MDAST_TYPE, undefined, {
        color: mark.attrs.color as string
      })
    }
  }
}))

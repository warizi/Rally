/**
 * 노트 텍스트 색상 Milkdown mark — `<span style="color:#xxx">text</span>` 라운드트립.
 *
 * 구조:
 * 1) remark 플러그인 (`colorSpanRemarkPlugin`) — 파싱된 mdast 의 paired html span 노드를
 *    커스텀 `colorSpan` mdast 노드로 wrapping
 * 2) Milkdown `colorMarkSchema` — ProseMirror mark schema. parseMarkdown 은
 *    `colorSpan` mdast 노드 매칭, toMarkdown 은 `state.withMark` 으로 `colorSpan` 출력
 * 3) remark-stringify 핸들러 (`colorSpanStringifyHandler`) — `colorSpan` mdast 노드를
 *    raw HTML `<span style="color:#xxx">...</span>` 으로 직렬화
 *
 * NoteEditor 에서 wiring:
 * ```ts
 * ctx.update(remarkPluginsCtx, (prev) => [...prev, { plugin: colorSpanRemarkPlugin, options: {} }])
 * ctx.update(remarkStringifyOptionsCtx, (prev) => ({
 *   ...prev,
 *   handlers: { ...prev.handlers, [COLOR_SPAN_MDAST_TYPE]: colorSpanStringifyHandler }
 * }))
 * .use(colorMarkSchema)
 * ```
 */
import { $markSchema } from '@milkdown/kit/utils'
import { visit } from 'unist-util-visit'
import type { Root, RootContent, PhrasingContent } from 'mdast'
import type { Handle } from 'mdast-util-to-markdown'

/** color mark 의 ProseMirror mark name. */
export const COLOR_MARK_NAME = 'colorMark'

/** remark 플러그인이 생성하는 mdast 노드 타입. */
export const COLOR_SPAN_MDAST_TYPE = 'colorSpan'

/** color span 의 시작 html 토큰 매칭 패턴. 캡처 그룹 1 = 색상 hex/색상값. */
const OPEN_SPAN_RE = /^<span\s+style\s*=\s*["']?\s*color\s*:\s*([^;"']+?)\s*;?\s*["']?\s*>$/i

/** color span 의 닫는 html 토큰 매칭. */
const CLOSE_SPAN_RE = /^<\/span\s*>$/i

function matchOpenColorSpan(value: string): string | null {
  const m = OPEN_SPAN_RE.exec(value.trim())
  return m ? m[1].trim() : null
}

function isCloseColorSpan(value: string): boolean {
  return CLOSE_SPAN_RE.test(value.trim())
}

/**
 * `<span style="color:#xxx">` ... `</span>` 페어를 찾아 `colorSpan` mdast 노드로 wrap.
 * 매칭되지 않는 span 또는 nested span 은 그대로 둠. 중첩 깊이 추적.
 */
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
          const wrapper = { type: COLOR_SPAN_MDAST_TYPE, color, children: innerChildren }
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

/**
 * remark 플러그인: mdast 트리의 모든 inline 컨테이너 노드에 대해 paired span 페어링 실행.
 */
export function colorSpanRemarkPlugin() {
  return (tree: Root): void => {
    visit(tree, (node) => {
      if ('children' in node && Array.isArray((node as { children: unknown[] }).children)) {
        pairColorSpansInChildren(node as RootContent & { children: unknown[] })
      }
    })
  }
}

/**
 * remark-stringify handler: `colorSpan` mdast 노드 → `<span style="color:#xxx">...</span>` raw HTML.
 */
export const colorSpanStringifyHandler: Handle = (node, _parent, state, info) => {
  const colorNode = node as unknown as { color: string; children: PhrasingContent[] }
  const inner = state.containerPhrasing(
    colorNode as unknown as Parameters<typeof state.containerPhrasing>[0],
    info
  )
  return `<span style="color:${colorNode.color}">${inner}</span>`
}

/**
 * Milkdown color mark schema.
 * - ProseMirror mark: attrs.color (string)
 * - parseDOM: span[style] 에서 color CSS 추출
 * - toDOM: `<span style="color: #xxx">` 렌더
 * - parseMarkdown: 위 remark 플러그인이 만든 `colorSpan` mdast 노드 매칭
 * - toMarkdown: `state.withMark` 으로 `colorSpan` mdast 노드 emit
 */
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
      const color = (node as unknown as { color: string }).color
      state.openMark(markType, { color })
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

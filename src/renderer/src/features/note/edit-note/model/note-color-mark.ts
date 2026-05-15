/**
 * 노트 텍스트 색상 Milkdown mark — `<span style="color:#xxx">text</span>` 라운드트립.
 *
 * 구조:
 * 1) remark 플러그인 (`colorSpanRemarkPlugin`) — 파싱된 mdast 의 paired html span 노드를
 *    커스텀 `colorSpan` mdast 노드로 wrapping
 * 2) Milkdown `colorMarkSchema` — ProseMirror mark schema (attrs: color + slot).
 *    parseMarkdown 은 `colorSpan` mdast 노드 매칭, toMarkdown 은 `state.withMark`
 *    으로 `colorSpan` 출력
 * 3) remark-stringify 핸들러 (`colorSpanStringifyHandler`) — `colorSpan` mdast 노드를
 *    raw HTML `<span style="color:#xxx" data-color-slot="N">...</span>` 으로 직렬화
 *
 * slot 속성: floating toolbar 의 팔레트 슬롯 인덱스 (0~7). null = 팔레트 외 색상.
 * 다크 모드에서 `[data-color-slot]` selector 로 CSS override (use-runtime-toolbar-colors).
 */
import { $markSchema } from '@milkdown/kit/utils'
import { visit } from 'unist-util-visit'
import type { Root, RootContent, PhrasingContent } from 'mdast'
import type { Handle } from 'mdast-util-to-markdown'

export const COLOR_MARK_NAME = 'colorMark'
export const COLOR_SPAN_MDAST_TYPE = 'colorSpan'

/**
 * color span 의 시작 html 토큰 매칭. 캡처 그룹:
 *   1 = 색상값 (hex / rgb / 이름 등)
 *   2 = data-color-slot 값 (있으면 — `data-color-slot="N"` 또는 `data-color-slot=N`)
 *
 * `style` 과 `data-color-slot` 의 순서는 무관 (양쪽 패턴 시도).
 */
const OPEN_SPAN_COLOR_RE = /color\s*:\s*([^;"'>]+?)\s*(?:;|["']|$)/i
const OPEN_SPAN_SLOT_RE = /data-color-slot\s*=\s*["']?(\d+)["']?/i

function matchOpenColorSpan(value: string): { color: string; slot: number | null } | null {
  const trimmed = value.trim()
  if (!/^<span\s+/i.test(trimmed)) return null
  if (!trimmed.endsWith('>')) return null
  if (trimmed.startsWith('</')) return null
  const colorM = OPEN_SPAN_COLOR_RE.exec(trimmed)
  if (!colorM) return null
  const slotM = OPEN_SPAN_SLOT_RE.exec(trimmed)
  const slot = slotM ? Number.parseInt(slotM[1], 10) : null
  return { color: colorM[1].trim(), slot: Number.isFinite(slot as number) ? slot : null }
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
      const open = matchOpenColorSpan(node.value)
      if (open) {
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
            color: open.color,
            slot: open.slot,
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
    slot: number | null
    children: PhrasingContent[]
  }
  const inner = state.containerPhrasing(
    colorNode as unknown as Parameters<typeof state.containerPhrasing>[0],
    info
  )
  const slotAttr = typeof colorNode.slot === 'number' ? ` data-color-slot="${colorNode.slot}"` : ''
  return `<span style="color:${colorNode.color}"${slotAttr}>${inner}</span>`
}

export const colorMarkSchema = $markSchema(COLOR_MARK_NAME, () => ({
  attrs: {
    color: { default: '#000000', validate: 'string' },
    slot: { default: null, validate: 'number|null' }
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
        const slotAttr = dom.getAttribute('data-color-slot')
        const slot =
          slotAttr !== null && /^\d+$/.test(slotAttr) ? Number.parseInt(slotAttr, 10) : null
        return { color: m[1].trim(), slot }
      }
    }
  ],
  toDOM: (mark) => {
    const slot = mark.attrs.slot as number | null
    const attrs: Record<string, string> = {
      style: `color: ${mark.attrs.color as string}`
    }
    if (typeof slot === 'number') {
      attrs['data-color-slot'] = String(slot)
    }
    return ['span', attrs, 0]
  },
  parseMarkdown: {
    match: (node) => node.type === COLOR_SPAN_MDAST_TYPE,
    runner: (state, node, markType) => {
      const data = node as unknown as { color: string; slot: number | null }
      state.openMark(markType, { color: data.color, slot: data.slot })
      const children = (node as unknown as { children: unknown }).children
      state.next(children as Parameters<typeof state.next>[0])
      state.closeMark(markType)
    }
  },
  toMarkdown: {
    match: (mark) => mark.type.name === COLOR_MARK_NAME,
    runner: (state, mark) => {
      state.withMark(mark, COLOR_SPAN_MDAST_TYPE, undefined, {
        color: mark.attrs.color as string,
        slot: mark.attrs.slot as number | null
      })
    }
  }
}))

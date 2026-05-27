/**
 * 노트 안 임베드 노드 (`![[domain:id|h=NNN]]`) 직렬화.
 *
 * Syntax:
 *   ![[note:id]]              — 노트 (제목 링크 형식, 높이 메타 없음)
 *   ![[csv:id|h=400]]         — CSV (h 메타 = 컨테이너 height)
 *   ![[pdf:id|h=600]]         — PDF
 *
 * 이미지(`![h=NNN](.images/xxx.png)`) 는 기존 image 노드 + alt 메타로 별도 처리.
 *
 * 흐름:
 * 1) remark plugin (rallyEmbedRemarkPlugin) — 파싱된 mdast text 노드 안에서
 *    `![[domain:id|h=NNN]]` 패턴 찾아 새 `rallyEmbed` mdast 노드로 분리.
 * 2) Milkdown `$nodeSchema('rally_embed')` — ProseMirror 노드. parseMarkdown 으로
 *    `rallyEmbed` mdast 매칭, toMarkdown 으로 raw text 출력.
 * 3) remark-stringify handler — `rallyEmbed` mdast → 원본 `![[domain:id|h=NNN]]`.
 *
 * MCP read 호환: markdown 파일에는 `![[domain:id|h=NNN]]` 그대로 저장 →
 * AI 가 raw text 에서 domain + id 식별 가능.
 */
import { $nodeSchema } from '@milkdown/kit/utils'
import { visit, SKIP } from 'unist-util-visit'
import type { Root, RootContent, Parent, PhrasingContent, Text } from 'mdast'
import type { Handle } from 'mdast-util-to-markdown'

export const RALLY_EMBED_NODE_NAME = 'rally_embed'
export const RALLY_EMBED_MDAST_TYPE = 'rallyEmbed'

export type EmbedDomain = 'note' | 'csv' | 'pdf' | 'image'

const EMBED_DOMAINS: readonly EmbedDomain[] = ['note', 'csv', 'pdf', 'image'] as const

function isEmbedDomain(s: string): s is EmbedDomain {
  return (EMBED_DOMAINS as readonly string[]).includes(s)
}

/** `![[domain:id|h=NNN]]` 패턴. global 매칭 + non-greedy.
 *
 * image 도메인은 workspace image-file 라이브러리 참조 (DnD 로 넣은 .images/
 * inline 이미지는 기존 markdown `![alt](path)` 그대로 — schema 자체가 다름). */
const EMBED_RE = /!\[\[(note|csv|pdf|image):([^\]|]+?)(?:\|h=(\d+))?\]\]/g

interface RallyEmbedMdastNode {
  type: typeof RALLY_EMBED_MDAST_TYPE
  domain: EmbedDomain
  entityId: string
  height?: number
}

/** mdast text 노드 안에서 패턴 매칭, embed 노드들과 잔여 text 로 분할. */
function splitTextNode(node: Text): Array<Text | RallyEmbedMdastNode> {
  const out: Array<Text | RallyEmbedMdastNode> = []
  const value = node.value
  let lastIdx = 0
  // exec loop with global flag
  const re = new RegExp(EMBED_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(value)) !== null) {
    const [full, domainRaw, idRaw, hRaw] = m
    if (!isEmbedDomain(domainRaw)) continue
    const start = m.index
    const end = start + full.length
    if (start > lastIdx) {
      out.push({ type: 'text', value: value.slice(lastIdx, start) })
    }
    const embed: RallyEmbedMdastNode = {
      type: RALLY_EMBED_MDAST_TYPE,
      domain: domainRaw,
      entityId: idRaw.trim()
    }
    if (hRaw) {
      const h = parseInt(hRaw, 10)
      if (!Number.isNaN(h) && h > 0) embed.height = h
    }
    out.push(embed)
    lastIdx = end
  }
  if (lastIdx < value.length) {
    out.push({ type: 'text', value: value.slice(lastIdx) })
  }
  return out.length === 0 ? [node] : out
}

/** remark plugin: paragraph 등의 children 에서 text 노드 분할 → embed 노드 끼워 넣기. */
export function rallyEmbedRemarkPlugin() {
  return (tree: Root): void => {
    visit(tree, (node, _index, parent: Parent | null) => {
      if (node.type !== 'text' || !parent || !Array.isArray(parent.children)) return
      const value = (node as Text).value
      if (!value.includes('![[')) return
      const parts = splitTextNode(node as Text)
      if (parts.length === 1 && parts[0] === node) return
      const idx = parent.children.indexOf(node as PhrasingContent & RootContent)
      if (idx === -1) return
      parent.children.splice(
        idx,
        1,
        ...(parts as Array<PhrasingContent & RootContent>)
      )
      // 같은 위치는 건너뛰고 다음으로 (children 길이 변경)
      return [SKIP, idx + parts.length] as [typeof SKIP, number]
    })
  }
}

/** remark-stringify handler: rallyEmbed mdast → 원본 syntax. */
export const rallyEmbedStringifyHandler: Handle = (node) => {
  const n = node as unknown as RallyEmbedMdastNode
  const suffix = n.height ? `|h=${n.height}` : ''
  return `![[${n.domain}:${n.entityId}${suffix}]]`
}

/** Milkdown ProseMirror 노드. inline atom — children 없이 attrs 만 보유. */
export const rallyEmbedSchema = $nodeSchema(RALLY_EMBED_NODE_NAME, () => ({
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  // mark (색상/굵게/코드 등) 적용 대상에서 제외 — 임베드 위에 mark 가 붙어
  // markdown round-trip 이 깨지는 일을 막는다.
  marks: '',
  attrs: {
    domain: { default: 'note', validate: 'string' },
    entityId: { default: '', validate: 'string' },
    height: { default: 0, validate: 'number' }
  },
  parseDOM: [
    {
      tag: 'span[data-rally-embed]',
      getAttrs: (dom: HTMLElement | string) => {
        if (typeof dom === 'string') return false
        const domain = dom.getAttribute('data-domain') ?? ''
        const entityId = dom.getAttribute('data-entity-id') ?? ''
        const heightAttr = dom.getAttribute('data-height')
        if (!isEmbedDomain(domain) || !entityId) return false
        return {
          domain,
          entityId,
          height: heightAttr ? parseInt(heightAttr, 10) || 0 : 0
        }
      }
    }
  ],
  toDOM: (node) => [
    'span',
    {
      'data-rally-embed': 'true',
      'data-domain': node.attrs.domain as string,
      'data-entity-id': node.attrs.entityId as string,
      'data-height': String(node.attrs.height ?? 0)
    }
  ],
  parseMarkdown: {
    match: (node) => node.type === RALLY_EMBED_MDAST_TYPE,
    runner: (state, node, nodeType) => {
      const n = node as unknown as RallyEmbedMdastNode
      state.addNode(nodeType, {
        domain: n.domain,
        entityId: n.entityId,
        height: n.height ?? 0
      })
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === RALLY_EMBED_NODE_NAME,
    runner: (state, node) => {
      const height = (node.attrs.height as number) || 0
      const data: Record<string, string | number> = {
        domain: node.attrs.domain as string,
        entityId: node.attrs.entityId as string
      }
      if (height > 0) data.height = height
      state.addNode(RALLY_EMBED_MDAST_TYPE, undefined, undefined, data)
    }
  }
}))

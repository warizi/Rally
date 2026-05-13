/**
 * Markdown paste 정규화 — clipboard 플러그인이 잘못된 path 를 타는 케이스를 방어한다.
 *
 * 1) **AI 응답 / 채팅 클립보드**: `text/plain` 은 markdown 원문, `text/html` 은
 *    그저 `<span>### 제목</span>` 같이 markdown 텍스트를 wrapping 만 한 형태.
 *    기본 clipboard 플러그인은 html 우선이라 markdown 으로 파싱 안 됨.
 *    → text/plain 이 명백한 markdown 구조 + text/html 에 의미있는 블록 태그 없음
 *      이면 markdown parser 로 강제 처리.
 *
 * 2) **옵시디언 호환**: 옵시디언은 복사 시 표 줄 사이에 빈 줄을 끼워 넣어 GFM 파서가
 *    표로 인식 못함. paste 직전 정규화.
 *
 * clipboard 플러그인 앞에서 실행하도록 `.use(notePasteNormalizePlugin).use(clipboard)` 순서.
 */
import { parserCtx, schemaCtx } from '@milkdown/kit/core'
import { DOMParser, DOMSerializer } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/utils'

/** 표/헤딩/코드블록/인용구/리스트 등 명백한 markdown 구조 패턴. */
function hasMarkdownStructure(text: string): boolean {
  return /^(#{1,6}\s|>\s|```|\|.*\||[-*]\s|\d+\.\s)/m.test(text)
}

/** h1-h6 / table / pre / blockquote / ol·ul / li 같은 의미있는 블록 태그 존재 여부. */
function hasStructuredHtml(html: string): boolean {
  return /<(h[1-6]|table|tr|td|th|pre|code|blockquote|ol|ul|li)\b/i.test(html)
}

/** `|...|` 표 줄들 사이의 빈 줄 제거 (옵시디언 등 호환). */
function normalizeTableLines(text: string): string {
  let result = text
  let prev: string
  do {
    prev = result
    result = result.replace(/(\|[^\n]*\|)\n\s*\n(\|[^\n]*\|)/g, '$1\n$2')
  } while (result !== prev)
  return result
}

export const notePasteNormalizePlugin = $prose((ctx) => {
  const key = new PluginKey('RALLY_NOTE_PASTE_NORMALIZE')
  return new Plugin({
    key,
    props: {
      handlePaste(view, event) {
        const clipboardData = event.clipboardData
        if (!clipboardData) return false
        const text = clipboardData.getData('text/plain')
        const html = clipboardData.getData('text/html')
        if (!text) return false

        const textHasMarkdown = hasMarkdownStructure(text)
        const htmlHasStructure = html ? hasStructuredHtml(html) : false

        // 두 조건 중 하나라도 트리거 되어야 plugin 이 처리. 그 외엔 clipboard 플러그인에게 위임.
        // (1) text 가 markdown 구조 + html 은 의미있는 태그 없음 (= AI 응답류)
        // (2) text 안에 표 줄 사이 빈 줄이 있음 (옵시디언 등)
        const shouldHandleAsMarkdown = textHasMarkdown && !htmlHasStructure
        const hasObsidianTablePattern = /\|[^\n]*\|\n\s*\n\|[^\n]*\|/.test(text)

        if (!shouldHandleAsMarkdown && !hasObsidianTablePattern) return false

        const normalized = normalizeTableLines(text)
        const parser = ctx.get(parserCtx)
        const schema = ctx.get(schemaCtx)
        const parsed = parser(normalized)
        if (!parsed || typeof parsed === 'string') return false

        const dom = DOMSerializer.fromSchema(schema).serializeFragment(parsed.content)
        const slice = DOMParser.fromSchema(schema).parseSlice(dom)
        try {
          view.dispatch(view.state.tr.replaceSelection(slice))
          event.preventDefault()
          return true
        } catch {
          return false
        }
      }
    }
  })
})

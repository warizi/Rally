import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorState } from '@milkdown/kit/prose/state'
import type { Node } from '@milkdown/kit/prose/model'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'

const syntaxHintKey = new PluginKey<DecorationSet>('note-syntax-hint')

// 블록 요소별 마크다운 문법 힌트. 커서가 위치한 블록(textblock)에만 인라인으로 표시된다.
// hr/리스트/코드블록 제외: hr 은 커서가 들어갈 수 없는 atomic void 요소라 인라인 표시가
// 불가(선택 시 위젯이 줄바꿈 + 툴바 충돌), 리스트·코드블록은 화면에 불릿/번호/언어라벨이
// 이미 렌더되어 중복.
const NODE_SYNTAX: Record<string, (node: Node) => string> = {
  heading: (node) => '#'.repeat(node.attrs.level as number),
  blockquote: () => '>'
}

function buildDecorations(state: EditorState): DecorationSet {
  const { selection, doc } = state
  const { from, to } = selection
  // collapsed 커서일 때만 (범위 선택 시 숨김)
  if (from !== to) return DecorationSet.empty

  const resolved = doc.resolve(from)

  // 1) 마커 텍스트: 커서에서 가장 가까운(innermost) 매칭 블록 (heading / blockquote …)
  let syntaxText = ''
  for (let depth = resolved.depth; depth >= 1; depth--) {
    const fn = NODE_SYNTAX[resolved.node(depth).type.name]
    if (fn) {
      syntaxText = fn(resolved.node(depth))
      break
    }
  }
  if (!syntaxText) return DecorationSet.empty

  // 2) 위치: 커서가 속한 innermost textblock(문단/제목)의 시작 → 텍스트와 같은 줄에 인라인 표시.
  //    (blockquote 처럼 컨테이너 블록의 시작에 두면 텍스트 위 줄로 빠지는 문제 방지)
  let blockStart = -1
  for (let depth = resolved.depth; depth >= 1; depth--) {
    if (resolved.node(depth).isTextblock) {
      blockStart = resolved.start(depth)
      break
    }
  }
  if (blockStart < 0) return DecorationSet.empty

  const widget = Decoration.widget(
    blockStart,
    () => {
      const span = document.createElement('span')
      span.className = 'syntax-hint'
      span.textContent = syntaxText
      return span
    },
    { side: -1 }
  )

  return DecorationSet.create(doc, [widget])
}

export const syntaxHintPlugin = $prose(() => {
  return new Plugin({
    key: syntaxHintKey,
    state: {
      init(_, state) {
        return buildDecorations(state)
      },
      apply(tr, old, _oldState, newState) {
        if (!tr.selectionSet && !tr.docChanged) return old
        return buildDecorations(newState)
      }
    },
    props: {
      decorations(state) {
        return syntaxHintKey.getState(state)
      }
    }
  })
})

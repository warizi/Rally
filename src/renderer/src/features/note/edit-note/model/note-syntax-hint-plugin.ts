import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'

const syntaxHintKey = new PluginKey<DecorationSet>('note-syntax-hint')

const NODE_SYNTAX: Record<string, (node: import('@milkdown/kit/prose/model').Node) => string> = {
  heading: (node) => '#'.repeat(node.attrs.level as number),
  horizontal_rule: () => '---',
}

function buildDecorations(
  doc: import('@milkdown/kit/prose/model').Node,
  cursorPos: number | null
): DecorationSet {
  if (cursorPos === null) return DecorationSet.empty

  const resolved = doc.resolve(cursorPos)
  // 커서가 속한 최상위 블록 찾기
  let blockStart = -1
  let blockEnd = -1
  let syntaxText = ''

  for (let depth = resolved.depth; depth >= 1; depth--) {
    const node = resolved.node(depth)
    const typeName = node.type.name
    if (NODE_SYNTAX[typeName]) {
      blockStart = resolved.start(depth)
      blockEnd = resolved.end(depth)
      syntaxText = NODE_SYNTAX[typeName](node)
      break
    }
  }

  if (!syntaxText || blockStart < 0) return DecorationSet.empty

  const widget = Decoration.widget(blockStart, () => {
    const span = document.createElement('span')
    span.className = 'syntax-hint'
    span.textContent = syntaxText
    return span
  }, { side: -1 })

  return DecorationSet.create(doc, [widget])
}

export const syntaxHintPlugin = $prose(() => {
  return new Plugin({
    key: syntaxHintKey,
    state: {
      init(_, state) {
        const { from } = state.selection
        return buildDecorations(state.doc, from)
      },
      apply(tr, old, _oldState, newState) {
        if (!tr.selectionSet && !tr.docChanged) return old
        const { from, to } = newState.selection
        // 범위 선택 시 숨기기
        if (from !== to) return DecorationSet.empty
        return buildDecorations(newState.doc, from)
      },
    },
    props: {
      decorations(state) {
        return syntaxHintKey.getState(state)
      },
    },
  })
})

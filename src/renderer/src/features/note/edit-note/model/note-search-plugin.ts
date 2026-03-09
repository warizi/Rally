import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'

export const searchPluginKey = new PluginKey<SearchState>('note-search')

interface SearchState {
  term: string
  decorations: DecorationSet
  matches: { from: number; to: number }[]
  activeIndex: number
}

function buildDecorations(
  doc: import('@milkdown/kit/prose/model').Node,
  term: string,
  activeIndex: number
): { decorations: DecorationSet; matches: { from: number; to: number }[] } {
  if (!term) {
    return { decorations: DecorationSet.empty, matches: [] }
  }

  const matches: { from: number; to: number }[] = []
  const search = term.toLowerCase()

  doc.descendants((node, pos) => {
    if (node.isText) {
      const text = node.text!.toLowerCase()
      let index = text.indexOf(search)
      while (index !== -1) {
        matches.push({ from: pos + index, to: pos + index + search.length })
        index = text.indexOf(search, index + 1)
      }
    }
  })

  const decorations = matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class: i === activeIndex ? 'search-highlight-active' : 'search-highlight'
    })
  )

  return { decorations: DecorationSet.create(doc, decorations), matches }
}

export const noteSearchPlugin = $prose(() => {
  return new Plugin({
    key: searchPluginKey,
    state: {
      init(): SearchState {
        return {
          term: '',
          decorations: DecorationSet.empty,
          matches: [] as { from: number; to: number }[],
          activeIndex: -1
        }
      },
      apply(tr, prev) {
        const meta = tr.getMeta(searchPluginKey)
        if (meta !== undefined) {
          const term = (meta.term ?? prev.term) as string
          const activeIndex = (meta.activeIndex ?? prev.activeIndex) as number
          const { decorations, matches } = buildDecorations(tr.doc, term, activeIndex)
          return { term, decorations, matches, activeIndex }
        }
        if (prev.term && tr.docChanged) {
          const { decorations, matches } = buildDecorations(tr.doc, prev.term, prev.activeIndex)
          return { ...prev, decorations, matches }
        }
        return prev
      }
    },
    props: {
      decorations(state) {
        return this.getState(state)?.decorations ?? DecorationSet.empty
      }
    }
  })
})

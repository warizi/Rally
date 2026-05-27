/**
 * `@` trigger plugin — 라인 시작 @ 입력 감지 시 picker store 활성화.
 *
 * 검색어 입력은 picker popup 의 별도 input 이 받음 (IME 한글 등 호환).
 * plugin 은 @ 감지 + range/position 기록만 담당. 후속 텍스트 입력은
 * ProseMirror 안에서 일어나지 않음 (popup input 으로 focus 이동).
 */
import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { useEmbedPickerStore } from './embed-picker-store'

const embedPickerKey = new PluginKey('rally-embed-picker')

function getCaretPosition(view: import('@milkdown/kit/prose/view').EditorView): {
  x: number
  y: number
} {
  const coords = view.coordsAtPos(view.state.selection.from)
  return { x: coords.left, y: coords.bottom }
}

function isLineStart(state: import('@milkdown/kit/prose/state').EditorState): boolean {
  const { $from } = state.selection
  return $from.parentOffset === 0
}

export const embedPickerPlugin = $prose(() => {
  return new Plugin({
    key: embedPickerKey,
    props: {
      handleTextInput(view, from, to, text) {
        // @ 입력 감지 (라인 시작에서만)
        if (text === '@' && isLineStart(view.state) && from === to) {
          queueMicrotask(() => {
            const newRange = { from, to: from + 1 }
            useEmbedPickerStore.getState().openPicker(newRange, getCaretPosition(view))
          })
        }
        return false
      }
    }
  })
})

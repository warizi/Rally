/**
 * `@` trigger plugin — 라인 시작 @ 입력 감지 시 picker store 활성화.
 *
 * 검색어 입력은 picker popup 의 별도 input 이 받음 (IME 한글 등 호환).
 * plugin 은 @ 감지 + range/position 기록만 담당. 후속 텍스트 입력은
 * ProseMirror 안에서 일어나지 않음 (popup input 으로 focus 이동).
 *
 * NoteEditor 가 여러 개 mount 되어 있을 때 (탭 + 캔버스 안 노트 등) 한
 * 에디터의 @ 가 다른 에디터의 popup 까지 열어버리지 않도록 factory 가
 * editorId 를 받아 store 에 함께 기록한다.
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

export function createEmbedPickerPlugin(editorId: string): ReturnType<typeof $prose> {
  return $prose(() => {
    return new Plugin({
      key: embedPickerKey,
      props: {
        handleTextInput(view, from, to, text) {
          // @ 입력 감지 (라인 시작에서만)
          if (text === '@' && isLineStart(view.state) && from === to) {
            queueMicrotask(() => {
              const newRange = { from, to: from + 1 }
              useEmbedPickerStore.getState().openPicker(editorId, newRange, getCaretPosition(view))
            })
          }
          return false
        }
      }
    })
  })
}

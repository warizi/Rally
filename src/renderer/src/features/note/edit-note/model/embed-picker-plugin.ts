/**
 * `@` trigger plugin — 라인 시작 @ 입력 감지하여 picker store 활성화.
 *
 * 동작:
 * - 라인 시작 (paragraph 안 parentOffset === 0 또는 직전이 공백/줄바꿈) 에서 `@` 입력
 * - picker store.openPicker(range, position) 호출
 * - 이후 텍스트 입력은 picker store.updateQuery 로 검색어 갱신
 * - 공백 / Esc / 다른 영역 클릭 → picker 닫기 (Esc / blur 는 React 측에서 처리)
 * - 화살표 키 / Enter 는 picker 가 listen — plugin 에서는 store.open 일 때 pass-through
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

/** 현재 커서가 라인 시작인지 (paragraph 의 첫 번째 텍스트 직전). */
function isLineStart(state: import('@milkdown/kit/prose/state').EditorState): boolean {
  const { $from } = state.selection
  return $from.parentOffset === 0
}

export const embedPickerPlugin = $prose(() => {
  return new Plugin({
    key: embedPickerKey,
    props: {
      handleTextInput(view, from, to, text) {
        const { open, range } = useEmbedPickerStore.getState()

        // picker 활성 상태 — 검색어 갱신 (공백 입력은 종료)
        if (open) {
          if (text === ' ') {
            useEmbedPickerStore.getState().closePicker()
            return false
          }
          // text 가 일반 문자면 query 에 append, range.to 갱신
          const newTo = to + text.length
          const newQuery = useEmbedPickerStore.getState().query + text
          useEmbedPickerStore.getState().updateQuery(newQuery, { from: range.from, to: newTo })
          // 텍스트 자체는 정상 삽입 (그래야 @검색어 가 노트에 보이고, picker close 시 그대로 남음)
          return false
        }

        // 새 @ 입력 감지: 라인 시작이고 입력 텍스트가 '@'
        if (text === '@' && isLineStart(view.state) && from === to) {
          // 삽입 이후 위치에 picker 활성. 입력 자체는 그대로.
          // queueMicrotask 로 다음 frame 에 openPicker (text 삽입 후 caret 위치 정확)
          queueMicrotask(() => {
            const newRange = { from, to: from + 1 }
            useEmbedPickerStore.getState().openPicker(newRange, getCaretPosition(view))
          })
          return false
        }

        return false
      },

      handleKeyDown(_view, event) {
        const { open } = useEmbedPickerStore.getState()
        if (!open) return false

        // 백스페이스: query 마지막 글자 제거. 만약 @ 가 사라지면 picker 닫기.
        if (event.key === 'Backspace') {
          const { query, range } = useEmbedPickerStore.getState()
          if (query.length === 0) {
            // @ 자체가 지워지는 경우 → picker 닫기 (delete 동작 자체는 ProseMirror 가 처리)
            useEmbedPickerStore.getState().closePicker()
            return false
          }
          const newQuery = query.slice(0, -1)
          useEmbedPickerStore.getState().updateQuery(newQuery, {
            from: range.from,
            to: range.to - 1
          })
          return false
        }

        // Esc / ArrowUp / ArrowDown / Enter 는 React picker 에서 listen — plugin 차단 안 함.
        // 단 Escape 는 picker 닫기 동작도 plugin 측에서 보조.
        if (event.key === 'Escape') {
          useEmbedPickerStore.getState().closePicker()
          return false
        }

        return false
      }
    }
  })
})

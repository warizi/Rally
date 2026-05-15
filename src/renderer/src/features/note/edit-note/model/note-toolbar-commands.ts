/**
 * Floating toolbar 에서 호출하는 Milkdown 커맨드.
 *
 * bold / italic / inlineCode 는 commonmark preset 의 기존 toggle 커맨드 재사용.
 * color 는 커스텀 — 동일 색상이면 mark 제거, 다른 색상이면 갈아끼움.
 */
import { $command } from '@milkdown/kit/utils'
import { toggleMark } from '@milkdown/kit/prose/commands'
import { COLOR_MARK_NAME } from './note-color-mark'

/**
 * 색상 mark 토글.
 *
 * - color = `undefined` → 현재 mark 제거
 * - color = hex → 동일 hex 면 제거, 다른 hex 면 갈아끼움
 */
export const toggleColorCommand = $command(
  'ToggleColorMark',
  (ctx) => (color?: string) => (state, dispatch) => {
    const markType = state.schema.marks[COLOR_MARK_NAME]
    if (!markType) return false
    void ctx

    if (color === undefined) {
      return toggleMark(markType)(state, dispatch)
    }

    const { from, to } = state.selection
    let hasSameColor = true
    let foundAny = false
    state.doc.nodesBetween(from, to, (node) => {
      if (!node.isText) return true
      const m = node.marks.find((mk) => mk.type === markType)
      if (m) {
        foundAny = true
        if ((m.attrs.color as string) !== color) hasSameColor = false
      } else {
        hasSameColor = false
      }
      return false
    })

    if (foundAny && hasSameColor) {
      if (dispatch) dispatch(state.tr.removeMark(from, to, markType))
      return true
    }

    if (dispatch) {
      const tr = state.tr
        .removeMark(from, to, markType)
        .addMark(from, to, markType.create({ color }))
      dispatch(tr)
    }
    return true
  }
)

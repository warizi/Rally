/**
 * Floating toolbar 에서 호출하는 Milkdown 커맨드.
 *
 * bold / italic / inlineCode 는 commonmark preset 의 기존 toggle 커맨드 재사용.
 * color 는 커스텀 — 동일 색상 이면 mark 제거 (toggle 의미), 다른 색상이면 갈아끼움.
 */
import { $command } from '@milkdown/kit/utils'
import { toggleMark } from '@milkdown/kit/prose/commands'
import { COLOR_MARK_NAME } from './note-color-mark'

/**
 * 색상 mark 토글.
 *
 * - color 인자 = `undefined` → 현재 mark 제거
 * - color 인자 = 새 hex → 기존 color mark 가 있으면 동일 hex 면 제거, 다른 hex 면 attrs 갱신
 */
export const toggleColorCommand = $command(
  'ToggleColorMark',
  (ctx) => (color?: string) => (state, dispatch) => {
    const markType = state.schema.marks[COLOR_MARK_NAME]
    if (!markType) return false
    void ctx

    // color 가 undefined → 단순 토글 (=현재 mark 제거 또는 토글 off)
    if (color === undefined) {
      return toggleMark(markType)(state, dispatch)
    }

    // 현재 selection 에 같은 색상 mark 가 균일하게 있으면 제거
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
      // 동일 색상 → 제거
      if (dispatch) dispatch(state.tr.removeMark(from, to, markType))
      return true
    }

    // 다른 색상이거나 mark 없음 → 새 color 로 적용 (기존 색상은 덮어씀)
    if (dispatch) {
      const tr = state.tr
        .removeMark(from, to, markType)
        .addMark(from, to, markType.create({ color }))
      dispatch(tr)
    }
    return true
  }
)

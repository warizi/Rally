/**
 * Floating toolbar 에서 호출하는 Milkdown 커맨드.
 *
 * bold / italic / inlineCode 는 commonmark preset 의 기존 toggle 커맨드 재사용.
 * color 는 커스텀 — 동일 색상이면 mark 제거, 다른 색상이면 갈아끼움.
 * slot 인덱스 함께 저장 (다크 모드 매핑용 — `data-color-slot` 속성으로 직렬화).
 */
import { $command } from '@milkdown/kit/utils'
import { toggleMark } from '@milkdown/kit/prose/commands'
import { COLOR_MARK_NAME } from './note-color-mark'

export interface ToggleColorPayload {
  /** hex 색상값. */
  color: string
  /** 팔레트 슬롯 인덱스 (0~7). 팔레트 외 색상이면 null. */
  slot: number | null
}

/**
 * 색상 mark 토글.
 *
 * - payload = `undefined` → 현재 mark 제거
 * - payload = `{ color, slot }` → 동일 hex 면 제거, 다른 hex 면 갈아끼움
 */
export const toggleColorCommand = $command(
  'ToggleColorMark',
  (ctx) => (payload?: ToggleColorPayload) => (state, dispatch) => {
    const markType = state.schema.marks[COLOR_MARK_NAME]
    if (!markType) return false
    void ctx

    if (payload === undefined) {
      return toggleMark(markType)(state, dispatch)
    }

    const { color, slot } = payload
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
        .addMark(from, to, markType.create({ color, slot }))
      dispatch(tr)
    }
    return true
  }
)

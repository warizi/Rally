/**
 * 일반 markdown(prose) 에서 Tab / Shift-Tab 처리 plugin.
 *
 * CodeMirror 코드블록과 달리, prose 영역에서 Tab 은 기본적으로 에디터 밖으로 포커스를
 * 이동시킨다(접근성 기본 동작). milkdown commonmark 는 리스트 항목에 한해 Tab=sink /
 * Shift-Tab=lift 를 바인딩하지만, 비-리스트 문단에서는 커맨드가 false 를 반환해 Tab 이
 * 그대로 버블링 → 포커스 아웃된다.
 *
 * 이 plugin 은:
 *  - 리스트 안: 항목 들여쓰기(sink) / 내어쓰기(lift)  ← milkdown 과 동일, 폴백 겸 보강
 *  - 비-리스트: 이벤트만 소비해 포커스 아웃 방지 (문단 선두 공백 삽입은 markdown 에서
 *    indented code block 으로 오인될 수 있어 일부러 삽입하지 않는다)
 */
import { $prose } from '@milkdown/kit/utils'
import { keymap } from '@milkdown/kit/prose/keymap'
import { sinkListItem, liftListItem } from '@milkdown/kit/prose/schema-list'
import type { Command } from '@milkdown/kit/prose/state'

const onTab: Command = (state, dispatch, view) => {
  const listItem = state.schema.nodes.list_item
  if (listItem && sinkListItem(listItem)(state, dispatch, view)) return true
  return true // 비-리스트: 포커스 아웃만 방지
}

const onShiftTab: Command = (state, dispatch, view) => {
  const listItem = state.schema.nodes.list_item
  if (listItem && liftListItem(listItem)(state, dispatch, view)) return true
  return true
}

export const noteTabIndentPlugin = $prose(() =>
  keymap({
    Tab: onTab,
    'Shift-Tab': onShiftTab
  })
)

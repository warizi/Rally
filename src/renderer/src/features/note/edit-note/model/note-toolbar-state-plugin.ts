/**
 * 노트 floating toolbar 의 상태 동기화 플러그인.
 *
 * ProseMirror EditorView 의 selection / composing 상태가 바뀔 때마다
 * 커스텀 DOM 이벤트 (`note-toolbar-state`) 를 editor DOM 에 dispatch.
 * React 측의 `NoteFloatingToolbar` 가 이 이벤트를 listen 해서 popup
 * 표시 여부 / 위치 / 활성 mark 를 결정한다.
 *
 * 이 분리 구조의 이유: ProseMirror state ↔ React state 직접 동기화는
 * 복잡하고 hook 순서 문제 발생 가능. DOM 이벤트는 plain pub/sub 이라
 * Milkdown 의 lifecycle 과 독립적이고 테스트도 쉬움.
 */
import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'

export const TOOLBAR_STATE_EVENT = 'note-toolbar-state'

export interface ToolbarRect {
  /** viewport 기준 px. */
  top: number
  left: number
  /** 선택 영역 너비 (toolbar 중심점 계산용). */
  width: number
  /** 선택 영역 높이. */
  height: number
}

export interface ToolbarActiveMarks {
  italic: boolean
  bold: boolean
  inlineCode: boolean
  /** colorMark attrs.color (있을 때만). */
  color?: string
}

export interface ToolbarStateDetail {
  /** 표시할지 여부. selection.empty 또는 composing 중이면 false. */
  visible: boolean
  /** visible=true 일 때 선택 영역의 viewport rect. */
  rect?: ToolbarRect
  /** visible=true 일 때 활성 mark 정보. */
  activeMarks?: ToolbarActiveMarks
}

const toolbarStatePluginKey = new PluginKey('note-toolbar-state')

function computeRect(view: EditorView, from: number, to: number): ToolbarRect {
  const fromCoords = view.coordsAtPos(from)
  const toCoords = view.coordsAtPos(to)
  const top = Math.min(fromCoords.top, toCoords.top)
  const bottom = Math.max(fromCoords.bottom, toCoords.bottom)
  const left = Math.min(fromCoords.left, toCoords.left)
  const right = Math.max(fromCoords.right, toCoords.right)
  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  }
}

function computeActiveMarks(view: EditorView): ToolbarActiveMarks {
  const { state } = view
  const { from, $from } = state.selection
  const marks = $from.marks()
  // stored marks (다음 입력에 적용될 marks) — 빈 selection 일 때 의미. 여기선 selection 만 사용.
  const result: ToolbarActiveMarks = {
    italic: false,
    bold: false,
    inlineCode: false
  }
  for (const m of marks) {
    if (m.type.name === 'emphasis') result.italic = true
    else if (m.type.name === 'strong') result.bold = true
    else if (m.type.name === 'inlineCode') result.inlineCode = true
    else if (m.type.name === 'colorMark') {
      const c = m.attrs.color as string | undefined
      if (typeof c === 'string') result.color = c
    }
  }
  // selection 범위 안에서 균일한 mark 만 active 로 판정.
  // 다른 위치에 있는 마크가 다를 수 있으므로 doc.rangeHasMark 로 보강.
  const schema = state.schema
  const fromPos = state.selection.from
  const toPos = state.selection.to
  const emphasisType = schema.marks.emphasis
  const strongType = schema.marks.strong
  const inlineCodeType = schema.marks.inlineCode
  const colorMarkType = schema.marks.colorMark

  // 균일 적용 여부 보강 (선택 전 범위에 mark 가 전부 있는지)
  // false 였던 항목은 그대로 두고, true 인 경우만 다시 확인
  if (result.italic && emphasisType && !state.doc.rangeHasMark(fromPos, toPos, emphasisType)) {
    result.italic = false
  }
  if (result.bold && strongType && !state.doc.rangeHasMark(fromPos, toPos, strongType)) {
    result.bold = false
  }
  if (
    result.inlineCode &&
    inlineCodeType &&
    !state.doc.rangeHasMark(fromPos, toPos, inlineCodeType)
  ) {
    result.inlineCode = false
  }
  if (result.color && colorMarkType && !state.doc.rangeHasMark(fromPos, toPos, colorMarkType)) {
    result.color = undefined
  }

  // 미사용 매개변수 경고 회피
  void from
  return result
}

function dispatchState(view: EditorView): void {
  const { selection } = view.state
  let detail: ToolbarStateDetail
  if (selection.empty || view.composing) {
    detail = { visible: false }
  } else {
    detail = {
      visible: true,
      rect: computeRect(view, selection.from, selection.to),
      activeMarks: computeActiveMarks(view)
    }
  }
  const event = new CustomEvent<ToolbarStateDetail>(TOOLBAR_STATE_EVENT, { detail })
  view.dom.dispatchEvent(event)
}

export const noteToolbarStatePlugin = $prose(() => {
  return new Plugin({
    key: toolbarStatePluginKey,
    view(view) {
      // 초기 상태 dispatch (mount 직후 toolbar 가 listener 등록되어 있으면 받음).
      // requestAnimationFrame 으로 한 틱 뒤로 미뤄서 listener 가 붙을 시간 확보.
      requestAnimationFrame(() => dispatchState(view))
      return {
        update(updatedView, prevState) {
          // selection 변경 또는 doc 변경 시에만 dispatch.
          const selectionChanged = !updatedView.state.selection.eq(prevState.selection)
          const docChanged = !updatedView.state.doc.eq(prevState.doc)
          if (!selectionChanged && !docChanged) return
          dispatchState(updatedView)
        }
      }
    },
    props: {
      // composition 이벤트로 IME 입력 중에는 toolbar 숨김.
      handleDOMEvents: {
        compositionstart(view) {
          const event = new CustomEvent<ToolbarStateDetail>(TOOLBAR_STATE_EVENT, {
            detail: { visible: false }
          })
          view.dom.dispatchEvent(event)
          return false
        },
        compositionend(view) {
          // IME 끝나면 selection 기준으로 다시 평가.
          dispatchState(view)
          return false
        }
      }
    }
  })
})

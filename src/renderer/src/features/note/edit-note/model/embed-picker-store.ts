/**
 * 노트 안 `@` trigger picker 상태 store (Zustand).
 *
 * ProseMirror plugin 이 @ 입력을 감지해 store 업데이트 → React 컴포넌트가
 * store 구독해서 popup 표시 / 닫기 / 위치 / 검색어 반영.
 *
 * `editorId` 격리: 한 페이지에 NoteEditor 인스턴스가 여러 개 (탭 + 캔버스
 * 안 노트) 있을 때, 한 에디터의 @ 가 다른 에디터의 picker 까지 열어버리는
 * cross-contamination 방지. openPicker 호출 시 editorId 를 함께 기록하고
 * EmbedPicker 가 자기 editorId 일 때만 표시.
 */
import { create } from 'zustand'

export interface PickerPosition {
  x: number
  y: number
}

/** picker 가 활성화된 범위 (커서 위치에서 @ 입력 시작 ~ 현재 커서). 선택 시 이 범위가 embed 로 치환됨. */
export interface PickerRange {
  from: number
  to: number
}

interface PickerState {
  open: boolean
  /** 현재 picker 를 trigger 한 NoteEditor 인스턴스 id (open=false 면 빈 문자열). */
  editorId: string
  position: PickerPosition
  /** @ 다음 입력 텍스트 (검색어). 첫 호출 시 빈 문자열. */
  query: string
  range: PickerRange
}

interface PickerActions {
  openPicker: (editorId: string, range: PickerRange, position: PickerPosition) => void
  updateQuery: (query: string, range: PickerRange) => void
  updatePosition: (position: PickerPosition) => void
  closePicker: () => void
}

type PickerStore = PickerState & PickerActions

const INITIAL: PickerState = {
  open: false,
  editorId: '',
  position: { x: 0, y: 0 },
  query: '',
  range: { from: 0, to: 0 }
}

export const useEmbedPickerStore = create<PickerStore>()((set) => ({
  ...INITIAL,
  openPicker: (editorId, range, position) =>
    set({ open: true, editorId, query: '', range, position }),
  updateQuery: (query, range) => set({ query, range }),
  updatePosition: (position) => set({ position }),
  closePicker: () => set({ ...INITIAL })
}))

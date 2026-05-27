/**
 * 노트 안 `@` trigger picker 상태 store (Zustand).
 *
 * ProseMirror plugin 이 @ 입력을 감지해 store 업데이트 → React 컴포넌트가
 * store 구독해서 popup 표시 / 닫기 / 위치 / 검색어 반영.
 * 선택 결과는 callback 으로 plugin 측에 통지하지 않고, store 의 `pendingInsert`
 * 를 plugin 이 구독해 dispatch.
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
  position: PickerPosition
  /** @ 다음 입력 텍스트 (검색어). 첫 호출 시 빈 문자열. */
  query: string
  range: PickerRange
}

interface PickerActions {
  openPicker: (range: PickerRange, position: PickerPosition) => void
  updateQuery: (query: string, range: PickerRange) => void
  updatePosition: (position: PickerPosition) => void
  closePicker: () => void
}

type PickerStore = PickerState & PickerActions

const INITIAL: PickerState = {
  open: false,
  position: { x: 0, y: 0 },
  query: '',
  range: { from: 0, to: 0 }
}

export const useEmbedPickerStore = create<PickerStore>()((set) => ({
  ...INITIAL,
  openPicker: (range, position) => set({ open: true, query: '', range, position }),
  updateQuery: (query, range) => set({ query, range }),
  updatePosition: (position) => set({ position }),
  closePicker: () => set({ ...INITIAL })
}))

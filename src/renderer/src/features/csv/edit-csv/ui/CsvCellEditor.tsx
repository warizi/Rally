import { JSX, useCallback, useRef, useEffect } from 'react'

type MoveSource = 'tab' | 'enter' | 'arrow'

interface Props {
  /** active 셀 위치(px, sized container 기준) */
  top: number
  left: number
  width: number
  height: number
  /** active 셀 식별자 — 바뀌면 포커스 재적용 */
  cellKey: string
  value: string
  onChange: (value: string) => void
  isEditing: boolean
  /** 타이핑/IME 로 편집 시작 알림 */
  onStartEditing: () => void
  onStopEdit: () => void
  /** 외부(F2/grid)에서 편집 진입 시 input 초기값. 문자 → 교체, null/undefined → 기존값 유지. */
  initialValue?: string | null
  onCommitAndMove: (dRow: number, dCol: number, source: MoveSource) => void
}

const ARROW_DELTA: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1]
}

/**
 * active(단일 선택) 셀 위에 떠 있는 단일 input. 항상 마운트(스크롤/네비에도 unmount 안 됨)되어 포커스 유지.
 *
 * 한글 IME 안정성을 위한 핵심 설계:
 * - **비편집 시 input 은 빈 상태**(셀 값은 뒤의 EditableCell div 가 표시). 타이핑 시 조합이 처음부터 빈
 *   input 에서 일어나므로 select()/clear 같은 값 조작이 전혀 필요 없다(조작이 첫 음절 조합을 깨뜨림).
 * - **조합 중에는 editing 전환(=리렌더)을 하지 않는다** — onCompositionEnd 에서 전환(첫 음절 조합 보존).
 * - **uncontrolled** — value prop 으로 DOM 을 강제하지 않는다.
 *
 * type-to-edit 교체: 빈 input 에 입력한 값을 commit 시 기존 value 와 비교해 반영 → 자연히 교체됨.
 * F2/더블클릭(내용 유지): 편집 진입 시 input.value 에 기존값을 채운다.
 */
export function CsvCellEditor({
  top,
  left,
  width,
  height,
  cellKey,
  value,
  onChange,
  isEditing,
  onStartEditing,
  onStopEdit,
  initialValue,
  onCommitAndMove
}: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const didCommitRef = useRef(false)
  const selfStartedRef = useRef(false)
  // composition 상태를 직접 추적 (e.nativeEvent.isComposing 은 Electron/Chromium 에서 첫 input 이벤트 때 불안정)
  const composingRef = useRef(false)

  // active 셀 변경(cellKey) & 비편집 → 빈 input + 포커스 (값은 셀 div 가 표시)
  useEffect(() => {
    if (isEditing) return
    didCommitRef.current = false
    const el = inputRef.current
    if (el) {
      el.value = ''
      el.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellKey])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    if (isEditing) {
      didCommitRef.current = false
      if (selfStartedRef.current) {
        // 타이핑/IME 로 스스로 시작 → DOM(조합 중 텍스트) 그대로 보존
        selfStartedRef.current = false
        return
      }
      // F2/grid 로 편집 진입 → 기존값(or seed) 채우고 커서 끝
      const seeded = initialValue != null ? initialValue : value
      el.value = seeded
      el.focus()
      const len = seeded.length
      el.setSelectionRange(len, len)
    } else {
      // 편집 종료 → idle: 빈 input
      el.value = ''
      el.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  const commit = useCallback(() => {
    if (didCommitRef.current) return
    didCommitRef.current = true
    const next = inputRef.current?.value ?? ''
    onStopEdit()
    if (next !== value) onChange(next)
  }, [value, onChange, onStopEdit])

  const startEditingFromInput = useCallback(() => {
    if (isEditing) return
    selfStartedRef.current = true
    onStartEditing()
  }, [isEditing, onStartEditing])

  return (
    <input
      ref={inputRef}
      data-csv-edit-input
      type="text"
      defaultValue=""
      style={{ position: 'absolute', top, left, width, height }}
      onCompositionStart={() => {
        composingRef.current = true
        // 조합 중엔 input 을 불투명하게 → 뒤의 셀 div(기존 값)와 겹쳐 보이지 않게.
        // React state 변경 없이 imperative 로 처리(조합 중 리렌더는 IME 를 깨뜨림).
        // compositionend → editing 전환 시 React className(bg-background)이 이어받는다.
        const el = inputRef.current
        if (el) {
          el.classList.remove('bg-transparent')
          el.classList.add('bg-background')
        }
      }}
      onInput={() => {
        // 조합 중에는 editing 전환(=리렌더) 금지 — 첫 음절 조합이 깨진다. 조합 완료 후 onCompositionEnd 에서 전환.
        if (!isEditing && !composingRef.current) startEditingFromInput()
      }}
      onCompositionEnd={() => {
        composingRef.current = false
        // 한글: 첫 음절 조합이 끝난 뒤에 editing 전환(조합 중 리렌더 방지).
        if (!isEditing) startEditingFromInput()
      }}
      onMouseDown={(e) => {
        if (isEditing) e.stopPropagation()
      }}
      onBlur={() => {
        if (isEditing) commit()
      }}
      onKeyDown={(e) => {
        const composing = composingRef.current
        if (isEditing) {
          e.stopPropagation()
          if (composing) return // IME 조합 확정용 키는 native 로 통과
          if (e.key === 'Tab') {
            e.preventDefault()
            commit()
            onCommitAndMove(0, e.shiftKey ? -1 : 1, 'tab')
            return
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
            onCommitAndMove(1, 0, 'enter')
            return
          }
          if (ARROW_DELTA[e.key]) {
            e.preventDefault()
            const [dr, dc] = ARROW_DELTA[e.key]
            commit()
            onCommitAndMove(dr, dc, 'arrow')
            return
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            didCommitRef.current = true
            if (inputRef.current) inputRef.current.value = ''
            onStopEdit()
          }
          return
        }

        // --- active, 비편집 (input 은 비어 있음) ---
        // IME/조합 키는 빈 input 에서 그대로 조합. **반드시 stopPropagation** —
        // grid 의 type-to-edit 가 IME keydown(일부 환경은 key 가 length 1)을 가로채 beginEdit(seed)로
        // 편집 진입시키면 첫 자모가 따로 커밋되어 조합이 깨진다.
        if (composing || e.key === 'Process' || e.keyCode === 229) {
          e.stopPropagation()
          return
        }
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          // 영문/숫자 → 빈 input 에 native 입력. grid type-to-edit 와 충돌 방지.
          e.stopPropagation()
          return
        }
        // 그 외(Arrow/Tab/Enter/F2/Delete/단축키) → native 차단 후 grid 로 bubble
        e.preventDefault()
      }}
      // 비편집: 빈 + 투명 + caret 숨김(셀 div 값이 비치고 '수정모드'처럼 안 보임).
      // 편집: 불투명 bg 로 셀 div 를 덮고 caret 표시. (className 변경은 compositionend 시점=음절 사이라 안전)
      className={
        'text-sm px-2 py-1 border-0 outline-none ring-2 ring-primary ring-inset' +
        (isEditing ? ' bg-background' : ' bg-transparent caret-transparent')
      }
    />
  )
}

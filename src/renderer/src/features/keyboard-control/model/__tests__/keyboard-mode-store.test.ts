/**
 * useKeyboardModeStore 단위 테스트.
 *
 * 핵심 시나리오: clearMode 는 인자로 받은 mode 가 현재 활성 모드와
 * 일치할 때만 null 로 reset → 다른 hook 의 deactivate 가 자기 모드의
 * set 결과를 덮어쓰지 않음 (modifier 순서 race).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useKeyboardModeStore } from '../keyboard-mode-store'

describe('useKeyboardModeStore', () => {
  beforeEach(() => {
    useKeyboardModeStore.setState({ mode: null })
  })

  it('초기 mode 는 null', () => {
    expect(useKeyboardModeStore.getState().mode).toBeNull()
  })

  it('setMode 로 활성화', () => {
    useKeyboardModeStore.getState().setMode('pane-nav')
    expect(useKeyboardModeStore.getState().mode).toBe('pane-nav')
  })

  it('clearMode 는 현재 활성 모드와 일치할 때만 null 로 reset', () => {
    useKeyboardModeStore.getState().setMode('pane-nav')
    useKeyboardModeStore.getState().clearMode('pane-nav')
    expect(useKeyboardModeStore.getState().mode).toBeNull()
  })

  it('clearMode 가 현재 모드와 다르면 no-op (다른 hook 의 모드 보호)', () => {
    // 시나리오 재현: pane hook 이 'pane-nav' 활성 → tab hook 의 onDeactivate 가
    // clearMode('tab-nav') 호출 → pane-nav 가 유지되어야 함.
    useKeyboardModeStore.getState().setMode('pane-nav')
    useKeyboardModeStore.getState().clearMode('tab-nav')
    expect(useKeyboardModeStore.getState().mode).toBe('pane-nav')
  })

  it('mode 가 null 상태에서 clearMode 호출 시 no-op', () => {
    useKeyboardModeStore.getState().clearMode('pane-nav')
    expect(useKeyboardModeStore.getState().mode).toBeNull()
  })

  it('setMode 로 모드 변경 — 다른 모드로 직접 교체 가능', () => {
    useKeyboardModeStore.getState().setMode('pane-nav')
    useKeyboardModeStore.getState().setMode('tab-nav')
    expect(useKeyboardModeStore.getState().mode).toBe('tab-nav')
  })

  it('순서 race 시뮬레이션: shift→ctrl 순으로 누르는 흐름 모사', () => {
    // 1) shift only → tab hook 이 onActivate (mode 변경 X, 단 activeRef=true)
    //    (이 단계에서 mode store 자체는 안 건드림)
    expect(useKeyboardModeStore.getState().mode).toBeNull()

    // 2) ctrl 추가 → pane hook 이 setMode('pane-nav') + 동일 이벤트에서
    //    tab hook mismatch → onDeactivate → clearMode('tab-nav')
    useKeyboardModeStore.getState().setMode('pane-nav')
    useKeyboardModeStore.getState().clearMode('tab-nav')

    // pane-nav 가 유지되어야 함 (이전 버그: clearMode() 가 무조건 null 로 reset)
    expect(useKeyboardModeStore.getState().mode).toBe('pane-nav')
  })
})

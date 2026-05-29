/**
 * features/terminal/terminal-panel-store.test.ts
 *
 * Terminal panel UI store — open/close/toggle + hasBeenOpened sticky.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalPanelStore } from '../terminal-panel-store'

beforeEach(() => {
  useTerminalPanelStore.getState().reset()
})

describe('useTerminalPanelStore', () => {
  it('초기 — isOpen=false, hasBeenOpened=false, panelSize=30', () => {
    const s = useTerminalPanelStore.getState()
    expect(s.isOpen).toBe(false)
    expect(s.hasBeenOpened).toBe(false)
    expect(s.panelSize).toBe(30)
  })

  it('open → isOpen=true + hasBeenOpened=true', () => {
    useTerminalPanelStore.getState().open()
    expect(useTerminalPanelStore.getState().isOpen).toBe(true)
    expect(useTerminalPanelStore.getState().hasBeenOpened).toBe(true)
  })

  it('close → isOpen=false, hasBeenOpened 은 변경 안 함', () => {
    useTerminalPanelStore.getState().open()
    useTerminalPanelStore.getState().close()
    expect(useTerminalPanelStore.getState().isOpen).toBe(false)
    expect(useTerminalPanelStore.getState().hasBeenOpened).toBe(true)
  })

  it('toggle (닫힌 상태) → 열림 + hasBeenOpened=true', () => {
    useTerminalPanelStore.getState().toggle()
    expect(useTerminalPanelStore.getState().isOpen).toBe(true)
    expect(useTerminalPanelStore.getState().hasBeenOpened).toBe(true)
  })

  it('toggle (열린 상태) → 닫힘, hasBeenOpened 유지', () => {
    useTerminalPanelStore.getState().open()
    useTerminalPanelStore.getState().toggle()
    expect(useTerminalPanelStore.getState().isOpen).toBe(false)
    expect(useTerminalPanelStore.getState().hasBeenOpened).toBe(true)
  })

  it('setPanelSize → 값만 갱신', () => {
    useTerminalPanelStore.getState().setPanelSize(45)
    expect(useTerminalPanelStore.getState().panelSize).toBe(45)
  })

  it('reset → 모든 필드 초기화', () => {
    useTerminalPanelStore.getState().open()
    useTerminalPanelStore.getState().setPanelSize(60)
    useTerminalPanelStore.getState().reset()
    const s = useTerminalPanelStore.getState()
    expect(s).toMatchObject({ isOpen: false, hasBeenOpened: false, panelSize: 30 })
  })
})

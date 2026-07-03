/**
 * shared/lib/keyboard-platform 단위 테스트 — OS별 modifier spec/라벨 분기.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { __resetPlatformCacheForTest } from '../platform'
import {
  primaryModifierSpec,
  primarySelectionKeyCode,
  primaryModifierLabel,
  altModifierLabel,
  shiftModifierLabel,
  comboLabel
} from '../keyboard-platform'

function setPlatform(platform: string): void {
  ;(window as unknown as { electron?: unknown }).electron = {
    process: { platform }
  }
}

beforeEach(() => {
  __resetPlatformCacheForTest()
})

afterEach(() => {
  delete (window as unknown as { electron?: unknown }).electron
  __resetPlatformCacheForTest()
})

describe('keyboard-platform (darwin)', () => {
  beforeEach(() => setPlatform('darwin'))

  it('primaryModifierSpec → { meta: true }', () => {
    expect(primaryModifierSpec()).toEqual({ meta: true })
  })

  it('selectionKeyCode → Meta, 라벨 → ⌘/⌥/⇧', () => {
    expect(primarySelectionKeyCode()).toBe('Meta')
    expect(primaryModifierLabel()).toBe('⌘')
    expect(altModifierLabel()).toBe('⌥')
    expect(shiftModifierLabel()).toBe('⇧')
  })

  it('comboLabel → 기호 연결 (⌘⇧F)', () => {
    expect(comboLabel('⌘', '⇧', 'F')).toBe('⌘⇧F')
  })
})

describe('keyboard-platform (win32)', () => {
  beforeEach(() => setPlatform('win32'))

  it('primaryModifierSpec → { ctrl: true }', () => {
    expect(primaryModifierSpec()).toEqual({ ctrl: true })
  })

  it('selectionKeyCode → Control, 라벨 → Ctrl/Alt/Shift', () => {
    expect(primarySelectionKeyCode()).toBe('Control')
    expect(primaryModifierLabel()).toBe('Ctrl')
    expect(altModifierLabel()).toBe('Alt')
    expect(shiftModifierLabel()).toBe('Shift')
  })

  it('comboLabel → + 연결 (Ctrl+Shift+F)', () => {
    expect(comboLabel('Ctrl', 'Shift', 'F')).toBe('Ctrl+Shift+F')
  })
})

/**
 * features/note/edit-note/model/embed-picker-store.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useEmbedPickerStore } from '../embed-picker-store'

beforeEach(() => {
  useEmbedPickerStore.getState().closePicker()
})

describe('useEmbedPickerStore', () => {
  it('초기 상태 — open=false, editorId 빈문자, query 빈문자', () => {
    const s = useEmbedPickerStore.getState()
    expect(s.open).toBe(false)
    expect(s.editorId).toBe('')
    expect(s.query).toBe('')
    expect(s.range).toEqual({ from: 0, to: 0 })
    expect(s.position).toEqual({ x: 0, y: 0 })
  })

  it('openPicker → open=true + 인자 반영', () => {
    useEmbedPickerStore.getState().openPicker('editor-1', { from: 5, to: 6 }, { x: 100, y: 200 })
    const s = useEmbedPickerStore.getState()
    expect(s.open).toBe(true)
    expect(s.editorId).toBe('editor-1')
    expect(s.range).toEqual({ from: 5, to: 6 })
    expect(s.position).toEqual({ x: 100, y: 200 })
    expect(s.query).toBe('')
  })

  it('updateQuery → query + range 갱신, open / editorId 유지', () => {
    useEmbedPickerStore.getState().openPicker('editor-1', { from: 5, to: 6 }, { x: 100, y: 200 })
    useEmbedPickerStore.getState().updateQuery('hello', { from: 5, to: 11 })
    const s = useEmbedPickerStore.getState()
    expect(s.query).toBe('hello')
    expect(s.range).toEqual({ from: 5, to: 11 })
    expect(s.open).toBe(true)
    expect(s.editorId).toBe('editor-1')
  })

  it('updatePosition → position 만 갱신', () => {
    useEmbedPickerStore.getState().openPicker('editor-1', { from: 5, to: 6 }, { x: 100, y: 200 })
    useEmbedPickerStore.getState().updatePosition({ x: 300, y: 400 })
    expect(useEmbedPickerStore.getState().position).toEqual({ x: 300, y: 400 })
    expect(useEmbedPickerStore.getState().open).toBe(true)
  })

  it('closePicker → 초기 상태 복귀', () => {
    useEmbedPickerStore.getState().openPicker('editor-1', { from: 5, to: 6 }, { x: 100, y: 200 })
    useEmbedPickerStore.getState().closePicker()
    const s = useEmbedPickerStore.getState()
    expect(s.open).toBe(false)
    expect(s.editorId).toBe('')
    expect(s.query).toBe('')
    expect(s.range).toEqual({ from: 0, to: 0 })
    expect(s.position).toEqual({ x: 0, y: 0 })
  })
})

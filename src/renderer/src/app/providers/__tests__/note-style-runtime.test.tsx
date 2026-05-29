/**
 * app/providers/note-style-runtime.test.tsx
 *
 * NoteStyleRuntime 은 useRuntimeNoteStyles 호출 후 null 반환 — 렌더 없음.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  called: false
}))

vi.mock('@features/note/manage-note-style', () => ({
  useRuntimeNoteStyles: () => {
    mocks.called = true
  }
}))

import { NoteStyleRuntime } from '../note-style-runtime'

describe('NoteStyleRuntime', () => {
  it('마운트 → useRuntimeNoteStyles 호출 + null 반환', () => {
    mocks.called = false
    const { container } = render(<NoteStyleRuntime />)
    expect(mocks.called).toBe(true)
    expect(container.firstChild).toBeNull()
  })
})

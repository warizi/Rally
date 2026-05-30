/**
 * entities/note/model/external-changed-event.test.ts
 */
import { describe, it, expect } from 'vitest'
import { NOTE_EXTERNAL_CHANGED_EVENT } from '../external-changed-event'

describe('NOTE_EXTERNAL_CHANGED_EVENT', () => {
  it('이벤트 이름 — "note:external-changed"', () => {
    expect(NOTE_EXTERNAL_CHANGED_EVENT).toBe('note:external-changed')
  })
})

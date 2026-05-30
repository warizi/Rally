/**
 * entities/pdf-file/model/external-changed-event.test.ts
 */
import { describe, it, expect } from 'vitest'
import { PDF_EXTERNAL_CHANGED_EVENT } from '../external-changed-event'

describe('PDF_EXTERNAL_CHANGED_EVENT', () => {
  it('이벤트 이름 — "pdf:external-changed"', () => {
    expect(PDF_EXTERNAL_CHANGED_EVENT).toBe('pdf:external-changed')
  })
})

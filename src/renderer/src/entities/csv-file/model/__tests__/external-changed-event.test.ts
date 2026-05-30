/**
 * entities/csv-file/model/external-changed-event.test.ts
 */
import { describe, it, expect } from 'vitest'
import { CSV_EXTERNAL_CHANGED_EVENT } from '../external-changed-event'

describe('CSV_EXTERNAL_CHANGED_EVENT', () => {
  it('이벤트 이름 — "csv:external-changed"', () => {
    expect(CSV_EXTERNAL_CHANGED_EVENT).toBe('csv:external-changed')
  })
})

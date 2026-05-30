/**
 * entities/image-file/model/external-changed-event.test.ts
 */
import { describe, it, expect } from 'vitest'
import { IMAGE_EXTERNAL_CHANGED_EVENT } from '../external-changed-event'

describe('IMAGE_EXTERNAL_CHANGED_EVENT', () => {
  it('이벤트 이름 — "image:external-changed"', () => {
    expect(IMAGE_EXTERNAL_CHANGED_EVENT).toBe('image:external-changed')
  })
})

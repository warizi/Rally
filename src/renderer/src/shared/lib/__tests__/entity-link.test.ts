/**
 * shared/lib/entity-link.test.ts — ENTITY_TYPE_LABEL + ENTITY_TYPE_ICON 매핑.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@shared/ui/icons/PdfIcon', () => ({
  PdfIcon: () => null
}))

import { ENTITY_TYPE_LABEL, ENTITY_TYPE_ICON } from '../entity-link'

const TYPES = ['todo', 'schedule', 'note', 'pdf', 'csv', 'image', 'canvas'] as const

describe('ENTITY_TYPE_LABEL', () => {
  it('7개 entity type 모두 한글 라벨 매핑', () => {
    for (const t of TYPES) {
      expect(ENTITY_TYPE_LABEL[t]).toBeTruthy()
      expect(typeof ENTITY_TYPE_LABEL[t]).toBe('string')
    }
  })

  it('주요 라벨 검증 — todo/schedule/note', () => {
    expect(ENTITY_TYPE_LABEL.todo).toBe('할 일')
    expect(ENTITY_TYPE_LABEL.schedule).toBe('일정')
    expect(ENTITY_TYPE_LABEL.note).toBe('노트')
  })
})

describe('ENTITY_TYPE_ICON', () => {
  it('7개 entity type 모두 icon 컴포넌트 매핑', () => {
    for (const t of TYPES) {
      expect(ENTITY_TYPE_ICON[t]).toBeTruthy()
    }
  })
})

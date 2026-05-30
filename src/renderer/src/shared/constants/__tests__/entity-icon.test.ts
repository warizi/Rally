/**
 * shared/constants/entity-icon.test.ts
 */
import { describe, it, expect } from 'vitest'
import { ENTITY_ICON, ENTITY_ICON_COLOR, getEntityColorByTabIcon } from '../entity-icon'

describe('entity-icon', () => {
  it('ENTITY_ICON — 6개 종류 (folder/note/csv/pdf/image/canvas)', () => {
    expect(Object.keys(ENTITY_ICON).sort()).toEqual(
      ['canvas', 'csv', 'folder', 'image', 'note', 'pdf'].sort()
    )
  })

  it('ENTITY_ICON_COLOR — Tailwind 500 톤', () => {
    expect(ENTITY_ICON_COLOR.folder).toMatch(/^#/)
    expect(ENTITY_ICON_COLOR.note).toBe('#3b82f6')
    expect(ENTITY_ICON_COLOR.canvas).toBe('#a855f7')
  })

  it('getEntityColorByTabIcon — 매칭', () => {
    expect(getEntityColorByTabIcon('folder')).toBe(ENTITY_ICON_COLOR.folder)
    expect(getEntityColorByTabIcon('note')).toBe(ENTITY_ICON_COLOR.note)
    expect(getEntityColorByTabIcon('canvas-detail')).toBe(ENTITY_ICON_COLOR.canvas)
  })

  it('getEntityColorByTabIcon — 매칭 안 됨 → undefined', () => {
    expect(getEntityColorByTabIcon('todo')).toBeUndefined()
    expect(getEntityColorByTabIcon('dashboard')).toBeUndefined()
  })
})

/**
 * app/layout/model/pane-routes.test.ts
 *
 * PANE_ROUTES 배열 — pattern 마다 component 가 함수형 (lazy)인지 검증.
 * ROUTES.DASHBOARD ~ TRASH 까지 15개 항목.
 */
import { describe, it, expect } from 'vitest'
import { PANE_ROUTES } from '../pane-routes'

describe('PANE_ROUTES', () => {
  it('15개 라우트 등록', () => {
    expect(PANE_ROUTES).toHaveLength(15)
  })

  it('모든 항목이 pattern + component (함수형) 포함', () => {
    for (const r of PANE_ROUTES) {
      expect(typeof r.pattern).toBe('string')
      expect(r.pattern.length).toBeGreaterThan(0)
      expect(r.component).toBeTypeOf('object')
    }
  })

  it('pattern 중복 없음', () => {
    const patterns = PANE_ROUTES.map((r) => r.pattern)
    expect(new Set(patterns).size).toBe(patterns.length)
  })
})

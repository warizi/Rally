/**
 * app/routes/router.test.ts
 *
 * DefaultRouter — createHashRouter 기반, 단일 / route.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../layout/MainLayout', () => ({
  default: () => null
}))

import { DefaultRouter } from '../router'

describe('DefaultRouter', () => {
  it('routes 1개 등록 (path "/")', () => {
    expect(DefaultRouter.routes).toHaveLength(1)
    expect(DefaultRouter.routes[0].path).toBe('/')
  })
})

/**
 * app/providers/onboarding-initializer.test.tsx
 *
 * hydrated=false → hydrate 호출 / hydrated=true → 호출 안 함.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  hydrate: vi.fn().mockResolvedValue(undefined),
  hydrated: false
}))

vi.mock('@shared/store/onboarding', () => ({
  useOnboardingStore: (sel: (s: { hydrate: typeof mocks.hydrate; hydrated: boolean }) => unknown) =>
    sel({ hydrate: mocks.hydrate, hydrated: mocks.hydrated })
}))

import { OnboardingInitializer } from '../onboarding-initializer'

beforeEach(() => {
  mocks.hydrate.mockClear().mockResolvedValue(undefined)
  mocks.hydrated = false
})

describe('OnboardingInitializer', () => {
  it('null 컴포넌트', () => {
    const { container } = render(<OnboardingInitializer />)
    expect(container.firstChild).toBeNull()
  })

  it('hydrated=false → hydrate 호출', () => {
    render(<OnboardingInitializer />)
    expect(mocks.hydrate).toHaveBeenCalled()
  })

  it('hydrated=true → hydrate 호출 안 함', () => {
    mocks.hydrated = true
    render(<OnboardingInitializer />)
    expect(mocks.hydrate).not.toHaveBeenCalled()
  })
})

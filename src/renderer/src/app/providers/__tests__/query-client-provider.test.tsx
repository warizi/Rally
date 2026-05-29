/**
 * app/providers/query-client-provider.test.tsx
 *
 * QueryClientProviderWrapper 마운트 + children 노출.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: { error: vi.fn() }
}))

import { QueryClientProviderWrapper } from '../query-client-provider'

describe('QueryClientProviderWrapper', () => {
  it('children 노출', () => {
    render(
      <QueryClientProviderWrapper>
        <div data-testid="child">child</div>
      </QueryClientProviderWrapper>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})

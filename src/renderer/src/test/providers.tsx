/**
 * 테스트용 Provider wrapper.
 *
 * 사용:
 *   render(<MyComponent />, { wrapper: TestProviders })
 */
import { type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@shared/ui/tooltip'
import { createTestQueryClient } from './query-client'

interface TestProvidersProps {
  children: ReactNode
  queryClient?: QueryClient
}

export function TestProviders({ children, queryClient }: TestProvidersProps): ReactNode {
  const qc = queryClient ?? createTestQueryClient()
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  )
}

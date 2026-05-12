/**
 * 테스트용 Provider wrapper.
 *
 * 사용:
 *   render(<MyComponent />, { wrapper: TestProviders })
 *
 * 주의: QueryClient 인스턴스는 useState 로 한 번만 생성. 매 render 새 인스턴스를
 * 만들면 context 값이 변해 모든 useQuery/useMutation consumer 가 rerender 되어
 * React.memo 효과가 사라진다. 메모이제이션 테스트가 정확하지 않게 된다.
 */
import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@shared/ui/tooltip'
import { createTestQueryClient } from './query-client'

interface TestProvidersProps {
  children: ReactNode
  queryClient?: QueryClient
}

export function TestProviders({ children, queryClient }: TestProvidersProps): ReactNode {
  // useState lazy init — 컴포넌트 인스턴스 수명 동안 동일 QueryClient 유지
  const [qc] = useState(() => queryClient ?? createTestQueryClient())
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  )
}

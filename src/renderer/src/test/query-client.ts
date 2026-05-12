import { QueryClient } from '@tanstack/react-query'

/** retry/캐시 비활성 테스트용 QueryClient. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  })
}

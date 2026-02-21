import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5 // 5분
    }
  }
})

export const QueryClientProviderWrapper = ({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element => {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

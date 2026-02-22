import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5 // 5분
    },
    mutations: {
      onSuccess: () => {
        toast.success('성공')
      },
      onError: (error) => {
        toast.error(error.message)
      }
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

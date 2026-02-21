import './styles/global.css'
import './styles/base.css'
import { TooltipProvider } from '@shared/ui/tooltip'
import { QueryClientProviderWrapper } from './providers'
import { Toaster } from '@/shared/ui/sonner'
import { RouterProvider } from 'react-router-dom'
import { DefaultRouter } from './routes'

function App(): React.JSX.Element {
  return (
    <QueryClientProviderWrapper>
      <TooltipProvider>
        <RouterProvider router={DefaultRouter} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProviderWrapper>
  )
}

export default App

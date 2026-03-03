import '@milkdown/crepe/theme/common/style.css'
import './styles/global.css'
import './styles/base.css'
import { TooltipProvider } from '@shared/ui/tooltip'
import { QueryClientProviderWrapper } from './providers'
import { Toaster } from '@/shared/ui/sonner'
import { RouterProvider } from 'react-router-dom'
import { DefaultRouter } from './routes'
import { WorkspaceInitializer } from './providers/workspace-initializer'
import { ThemeInitializer } from './providers/theme-initializer'

function App(): React.JSX.Element {
  return (
    <QueryClientProviderWrapper>
      <TooltipProvider>
        <WorkspaceInitializer />
        <ThemeInitializer />
        <RouterProvider router={DefaultRouter} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProviderWrapper>
  )
}

export default App

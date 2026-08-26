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
import { OnboardingInitializer } from './providers/onboarding-initializer'
import { OnboardingStepWatcher } from './providers/onboarding-step-watcher'
import { NoteStyleRuntime } from './providers/note-style-runtime'
import { WelcomeModalContainer } from '@widgets/onboarding'
import { ErrorBoundary } from '@shared/ui/error-boundary'
import { AppErrorFallback } from '@shared/ui/error-fallback'

function App(): React.JSX.Element {
  return (
    // M-5: 탭 경계(PaneContent)가 놓친 오류 — 레이아웃·사이드바·프로바이더 렌더 실패 —
    // 를 잡는 최후 경계. 여기까지 오면 화면 전체가 날아간 상황이다.
    <ErrorBoundary
      label="app"
      fallback={(error, reset) => <AppErrorFallback error={error} reset={reset} />}
    >
      <QueryClientProviderWrapper>
        <TooltipProvider>
          <WorkspaceInitializer />
          <ThemeInitializer />
          <OnboardingInitializer />
          <OnboardingStepWatcher />
          <NoteStyleRuntime />
          <RouterProvider router={DefaultRouter} />
          <WelcomeModalContainer />
          <Toaster />
        </TooltipProvider>
      </QueryClientProviderWrapper>
    </ErrorBoundary>
  )
}

export default App

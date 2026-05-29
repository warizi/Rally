/**
 * app/App.test.tsx
 *
 * App 마운트 시 핵심 자식 컴포넌트 (initializers + RouterProvider) 가 모두 렌더된다.
 * Smoke 테스트 — Milkdown CSS import 등 사이드이펙트만 검증.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@milkdown/crepe/theme/common/style.css', () => ({}))
vi.mock('../styles/global.css', () => ({}))
vi.mock('../styles/base.css', () => ({}))

vi.mock('@shared/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('../providers', () => ({
  QueryClientProviderWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-provider">{children}</div>
  )
}))

vi.mock('@/shared/ui/sonner', () => ({
  Toaster: () => <div data-testid="toaster" />
}))

vi.mock('react-router-dom', () => ({
  RouterProvider: () => <div data-testid="router-provider" />
}))

vi.mock('../routes', () => ({
  DefaultRouter: {}
}))

vi.mock('../providers/workspace-initializer', () => ({
  WorkspaceInitializer: () => <div data-testid="workspace-init" />
}))

vi.mock('../providers/theme-initializer', () => ({
  ThemeInitializer: () => <div data-testid="theme-init" />
}))

vi.mock('../providers/onboarding-initializer', () => ({
  OnboardingInitializer: () => <div data-testid="onboarding-init" />
}))

vi.mock('../providers/onboarding-step-watcher', () => ({
  OnboardingStepWatcher: () => <div data-testid="onboarding-watcher" />
}))

vi.mock('../providers/note-style-runtime', () => ({
  NoteStyleRuntime: () => <div data-testid="note-style" />
}))

vi.mock('@widgets/onboarding', () => ({
  WelcomeModalContainer: () => <div data-testid="welcome-modal" />
}))

import App from '../App'

describe('App', () => {
  it('모든 핵심 자식 컴포넌트 마운트', () => {
    render(<App />)
    expect(screen.getByTestId('query-provider')).toBeInTheDocument()
    expect(screen.getByTestId('workspace-init')).toBeInTheDocument()
    expect(screen.getByTestId('theme-init')).toBeInTheDocument()
    expect(screen.getByTestId('onboarding-init')).toBeInTheDocument()
    expect(screen.getByTestId('onboarding-watcher')).toBeInTheDocument()
    expect(screen.getByTestId('note-style')).toBeInTheDocument()
    expect(screen.getByTestId('router-provider')).toBeInTheDocument()
    expect(screen.getByTestId('welcome-modal')).toBeInTheDocument()
    expect(screen.getByTestId('toaster')).toBeInTheDocument()
  })
})

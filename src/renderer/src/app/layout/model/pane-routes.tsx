import { lazy, type ComponentType } from 'react'
import { ROUTES } from '@shared/constants/url'

// 라우트 파라미터 타입
export interface RouteParams {
  [key: string]: string
}

// 페이지 컴포넌트 Props (optional for compatibility with react-router)
export interface PageProps {
  tabId?: string
  params?: RouteParams
  search?: Record<string, string>
}

// 라우트 설정
export interface PaneRoute {
  pattern: string
  component: ComponentType<PageProps>
}

const DashboardPage = lazy(() => import('@pages/dashboard'))
const TodoPage = lazy(() => import('@pages/todo'))
const NoteFolderPage = lazy(() => import('@pages/note-folder'))

export const PANE_ROUTES: PaneRoute[] = [
  {
    pattern: ROUTES.DASHBOARD,
    component: DashboardPage
  },
  {
    pattern: ROUTES.TODO,
    component: TodoPage
  },
  {
    pattern: ROUTES.NOTE_FOLDER,
    component: NoteFolderPage
  }
]

import { lazy, type ComponentType } from 'react'
import { ROUTES } from '@/shared/constants/tab-url'

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
const TodoDetailPage = lazy(() => import('@pages/todo-detail'))
const FolderPage = lazy(() => import('@/pages/folder'))
const NotePage = lazy(() => import('@pages/note'))
const CsvPage = lazy(() => import('@pages/csv'))
const PdfPage = lazy(() => import('@pages/pdf'))
const ImagePage = lazy(() => import('@pages/image'))
const CalendarPage = lazy(() => import('@pages/calendar'))
const CanvasListPage = lazy(() => import('@pages/canvas'))
const CanvasDetailPage = lazy(() => import('@pages/canvas-detail'))
const TerminalPage = lazy(() => import('@pages/terminal'))
const ChangelogPage = lazy(() => import('@pages/changelog'))

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
    pattern: ROUTES.TODO_DETAIL,
    component: TodoDetailPage
  },
  {
    pattern: ROUTES.FOLDER,
    component: FolderPage
  },
  {
    pattern: ROUTES.NOTE_DETAIL,
    component: NotePage
  },
  {
    pattern: ROUTES.CSV_DETAIL,
    component: CsvPage
  },
  {
    pattern: ROUTES.PDF_DETAIL,
    component: PdfPage
  },
  {
    pattern: ROUTES.IMAGE_DETAIL,
    component: ImagePage
  },
  {
    pattern: ROUTES.CALENDAR,
    component: CalendarPage
  },
  {
    pattern: ROUTES.CANVAS,
    component: CanvasListPage
  },
  {
    pattern: ROUTES.CANVAS_DETAIL,
    component: CanvasDetailPage
  },
  {
    pattern: ROUTES.TERMINAL,
    component: TerminalPage
  },
  {
    pattern: ROUTES.CHANGELOG,
    component: ChangelogPage
  }
]

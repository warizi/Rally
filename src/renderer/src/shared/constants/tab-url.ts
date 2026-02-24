import { Calendar, Check, FolderOpen, LayoutDashboard, Notebook } from 'lucide-react'

export type TabType = 'dashboard' | 'todo' | 'todo-detail' | 'folder' | 'note' | 'calendar'

export type TabIcon = TabType

export const TAB_ICON: Record<TabIcon, React.ElementType> = {
  dashboard: LayoutDashboard,
  todo: Check,
  'todo-detail': Check,
  folder: FolderOpen,
  note: Notebook,
  calendar: Calendar
}

// 정적 라우트
export const ROUTES = {
  DASHBOARD: '/dashboard',
  TODO: '/todo',
  FOLDER: '/folder',
  SETTINGS: '/settings',
  // 노트 상세
  NOTE_DETAIL: '/folder/note/:noteId',
  CALENDAR: '/calendar'
} as const

export type RoutePattern = (typeof ROUTES)[keyof typeof ROUTES]

// 하위 호환성
export const AppUrls = ROUTES

export interface SidebarItem {
  title: string
  tabType: TabType
  pathname: string
  icon: React.ElementType
}

export const sidebar_items: SidebarItem[] = [
  {
    title: '대시보드',
    tabType: 'dashboard',
    pathname: ROUTES.DASHBOARD,
    icon: TAB_ICON['dashboard']
  },
  {
    title: '할 일',
    tabType: 'todo',
    pathname: ROUTES.TODO,
    icon: TAB_ICON['todo']
  },
  {
    title: '파일 탐색기',
    tabType: 'folder',
    pathname: ROUTES.FOLDER,
    icon: TAB_ICON['folder']
  },
  {
    title: '캘린더',
    tabType: 'calendar',
    pathname: ROUTES.CALENDAR,
    icon: TAB_ICON['calendar']
  }
]

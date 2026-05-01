import {
  Calendar,
  Check,
  Clock,
  FileText,
  FolderOpen,
  History,
  ImageIcon,
  LayoutDashboard,
  Network,
  Sheet,
  Terminal,
  Trash2
} from 'lucide-react'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'

export type TabType =
  | 'dashboard'
  | 'todo'
  | 'todo-detail'
  | 'folder'
  | 'note'
  | 'csv'
  | 'pdf'
  | 'image'
  | 'calendar'
  | 'canvas'
  | 'canvas-detail'
  | 'terminal'
  | 'changelog'
  | 'history'
  | 'trash'

export type TabIcon = TabType

export const TAB_ICON: Record<TabIcon, React.ElementType> = {
  dashboard: LayoutDashboard,
  todo: Check,
  'todo-detail': Check,
  folder: FolderOpen,
  note: FileText,
  csv: Sheet,
  pdf: PdfIcon,
  image: ImageIcon,
  calendar: Calendar,
  canvas: Network,
  'canvas-detail': Network,
  terminal: Terminal,
  changelog: History,
  history: Clock,
  trash: Trash2
}

// 정적 라우트
export const ROUTES = {
  DASHBOARD: '/dashboard',
  TODO: '/todo',
  TODO_DETAIL: '/todo/:todoId',
  FOLDER: '/folder',
  SETTINGS: '/settings',
  // 노트 상세
  NOTE_DETAIL: '/folder/note/:noteId',
  // CSV 상세
  CSV_DETAIL: '/folder/csv/:csvId',
  // PDF 상세
  PDF_DETAIL: '/folder/pdf/:pdfId',
  // Image 상세
  IMAGE_DETAIL: '/folder/image/:imageId',
  CALENDAR: '/calendar',
  CANVAS: '/canvas',
  CANVAS_DETAIL: '/canvas/:canvasId',
  TERMINAL: '/terminal',
  CHANGELOG: '/changelog',
  HISTORY: '/history',
  TRASH: '/trash'
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
  },
  {
    title: '캔버스',
    tabType: 'canvas',
    pathname: ROUTES.CANVAS,
    icon: TAB_ICON['canvas']
  },
  {
    title: '히스토리',
    tabType: 'history',
    pathname: ROUTES.HISTORY,
    icon: TAB_ICON['history']
  }
]

/** 시스템 영역(사이드바 하단)에 노출되는 항목 — 휴지통, 설정 등 */
export const system_sidebar_items: SidebarItem[] = [
  {
    title: '휴지통',
    tabType: 'trash',
    pathname: ROUTES.TRASH,
    icon: TAB_ICON['trash']
  }
]

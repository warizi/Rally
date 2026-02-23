import { TabType } from '@/entities/tab-system'
import { LayoutDashboard, FolderOpen, FileText, type LucideIcon, Check } from 'lucide-react'

// 탭 타입별 기본 아이콘
export const TAB_TYPE_ICONS: Record<TabType, LucideIcon> = {
  dashboard: LayoutDashboard,
  todo: Check,
  'todo-detail': Check,
  'note-folder': FolderOpen,
  note: FileText
}

// 패인 기본 설정
export const PANE_DEFAULTS = {
  MIN_SIZE: 200,
  DEFAULT_SIZE: 50
} as const

// 레이아웃 기본 설정
export const LAYOUT_DEFAULTS = {
  DEFAULT_PANE_ID: 'main',
  DEFAULT_SPLIT_SIZE: 50
} as const

import { TabIcon } from '@/entities/tab-system'
import { Check, FolderOpen, LayoutDashboard, Notebook } from 'lucide-react'

export const TAB_ICON: Record<TabIcon, React.ElementType> = {
  dashboard: LayoutDashboard,
  todo: Check,
  'todo-detail': Check,
  'note-folder': FolderOpen,
  note: Notebook
}

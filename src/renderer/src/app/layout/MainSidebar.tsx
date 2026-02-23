import { TabType } from '@/entities/tab-system'
import { useTabStore } from '@/features/tap-system/manage-tab-system'
import { WorkspaceSwitcher } from '@/features/workspace/switch-workspace'
import { ROUTES } from '@/shared/constants/url'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/shared/ui/sidebar'
import { FolderOpen, Home, ListTodo } from 'lucide-react'

interface SidebarItem {
  title: string
  tabType: TabType
  pathname: string
  icon: typeof Home
}

const items: SidebarItem[] = [
  {
    title: '대시보드',
    tabType: 'dashboard',
    pathname: ROUTES.DASHBOARD,
    icon: Home
  },
  {
    title: '할 일',
    tabType: 'todo',
    pathname: ROUTES.TODO,
    icon: ListTodo
  },
  {
    title: '노트 폴더',
    tabType: 'note-folder',
    pathname: ROUTES.NOTE_FOLDER,
    icon: FolderOpen
  }
]

function MainSidebar(): React.JSX.Element {
  const openTab = useTabStore((state) => state.openTab)
  const tabs = useTabStore((state) => state.tabs)
  const panes = useTabStore((state) => state.panes)
  const activePaneId = useTabStore((state) => state.activePaneId)

  // 현재 활성 탭의 pathname 확인
  const activePane = panes[activePaneId]
  const activeTab = activePane?.activeTabId ? tabs[activePane.activeTabId] : null
  const activePathname = activeTab?.pathname

  const handleOpenStaticTab = (item: SidebarItem): void => {
    openTab({ type: item.tabType, pathname: item.pathname, title: item.title })
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>기능</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.pathname}>
                  <SidebarMenuButton
                    isActive={activePathname === item.pathname}
                    tooltip={item.title}
                    onClick={() => handleOpenStaticTab(item)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>탭 스냅샷</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu></SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>기타</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu></SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

export default MainSidebar

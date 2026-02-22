import { WorkspaceSwitcher } from '@/features/workspace/switch-workspace'
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
import { Home, ListTodo, NotebookText } from 'lucide-react'

interface SidebarItem {
  title: string
  pathname: string
  icon: typeof Home
}

const items: SidebarItem[] = [
  {
    title: '대시보드',
    pathname: '/dashboard',
    icon: Home
  },
  {
    title: '할 일',
    pathname: '/todo',
    icon: ListTodo
  },
  {
    title: '노트',
    pathname: '/note',
    icon: NotebookText
  }
]

function MainSidebar(): React.JSX.Element {
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
                  <SidebarMenuButton tooltip={item.title}>
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

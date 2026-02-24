import { useTabStore, applySessionToStore } from '@/features/tap-system/manage-tab-system'
import type { SerializedTab, SessionData } from '@/features/tap-system/manage-tab-system'
import { useUpdateTabSnapshot } from '@/entities/tab-snapshot'
import type { TabSnapshot } from '@/entities/tab-snapshot'
import { TabSnapshotSection } from '@/features/tab-snapshot/manage-tab-snapshot'
import { WorkspaceSwitcher } from '@/features/workspace/switch-workspace'
import { sidebar_items, SidebarItem } from '@/shared/constants/tab-url'
import { useCurrentWorkspaceStore } from '@/shared/store/current-workspace'
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

function MainSidebar(): React.JSX.Element {
  const openTab = useTabStore((state) => state.openTab)
  const { mutate: updateSnapshot } = useUpdateTabSnapshot()
  const tabs = useTabStore((state) => state.tabs)
  const panes = useTabStore((state) => state.panes)
  const activePaneId = useTabStore((state) => state.activePaneId)
  const currentWorkspaceId = useCurrentWorkspaceStore((state) => state.currentWorkspaceId)

  // 현재 활성 탭의 pathname 확인
  const activePane = panes[activePaneId]
  const activeTab = activePane?.activeTabId ? tabs[activePane.activeTabId] : null
  const activePathname = activeTab?.pathname

  const handleOpenStaticTab = (item: SidebarItem): void => {
    openTab({ type: item.tabType, pathname: item.pathname, title: item.title })
  }

  const handleOverwrite = (snapshot: TabSnapshot): void => {
    const { tabs, panes, layout } = useTabStore.getState()
    updateSnapshot({
      id: snapshot.id,
      tabsJson: JSON.stringify(tabs),
      panesJson: JSON.stringify(panes),
      layoutJson: JSON.stringify(layout)
    })
  }

  const handleRestore = (snapshot: TabSnapshot): void => {
    const panes = JSON.parse(snapshot.panesJson) as SessionData['panes']
    const sessionData: SessionData = {
      tabs: JSON.parse(snapshot.tabsJson) as Record<string, SerializedTab>,
      panes,
      layout: JSON.parse(snapshot.layoutJson) as SessionData['layout'],
      activePaneId: Object.keys(panes)[0] ?? ''
    }
    applySessionToStore(sessionData)
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
              {sidebar_items.map((item) => (
                <SidebarMenuItem key={item.pathname}>
                  <SidebarMenuButton
                    className="cursor-pointer"
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
        {currentWorkspaceId && (
          <TabSnapshotSection
            workspaceId={currentWorkspaceId}
            onRestoreSnapshot={handleRestore}
            onOverwriteSnapshot={handleOverwrite}
          />
        )}
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

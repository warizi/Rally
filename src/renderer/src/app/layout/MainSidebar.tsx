import { lazy, Suspense, useState } from 'react'
import { Search, Settings } from 'lucide-react'
import { useTabStore } from '@/entities/tab-system'
import { useGlobalSearchStore } from '@/widgets/global-search'
import { applyTabSnapshot } from '@/features/tab-snapshot/manage-tab-snapshot'
import { useUpdateTabSnapshot } from '@/entities/tab-snapshot'
import type { TabSnapshot } from '@/entities/tab-snapshot'
import { TabSnapshotSection } from '@/features/tab-snapshot/manage-tab-snapshot'
import { WorkspaceSwitcher } from '@/features/workspace/switch-workspace'
import { sidebar_items, system_sidebar_items, SidebarItem } from '@/shared/constants/tab-url'
import { useCurrentWorkspaceStore } from '@/shared/store/current-workspace'
import { ScrollArea } from '@/shared/ui/scroll-area'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger
} from '@/shared/ui/sidebar'

// SettingsDialog 는 milkdown/codemirror/prosemirror 편집기 스택(~480KB gzip)을 끌어온다.
// 앱 셸(eager)에서 직접 import 하면 메인 청크에 합류하므로, 최초로 설정을 열 때만 로드한다.
// 한 번 열린 뒤에는 계속 mount 유지 → Radix Dialog 의 닫힘 애니메이션 보존.
const SettingsDialog = lazy(() =>
  import('@widgets/settings').then((m) => ({ default: m.SettingsDialog }))
)

function MainSidebar(): React.JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsMounted, setSettingsMounted] = useState(false)
  const openTab = useTabStore((state) => state.openTab)
  const { mutate: updateSnapshot } = useUpdateTabSnapshot()
  const tabs = useTabStore((state) => state.tabs)
  const panes = useTabStore((state) => state.panes)
  const activePaneId = useTabStore((state) => state.activePaneId)
  const currentWorkspaceId = useCurrentWorkspaceStore((state) => state.currentWorkspaceId)
  const openGlobalSearch = useGlobalSearchStore((s) => s.setOpen)

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
    applyTabSnapshot(snapshot)
  }

  return (
    <>
      <Sidebar collapsible="icon" variant="floating" className="!top-9 !h-[calc(100svh-2.2rem)]">
        <SidebarHeader>
          <WorkspaceSwitcher />
        </SidebarHeader>
        <SidebarContent className="!overflow-hidden">
          <ScrollArea className="flex-1 min-h-0">
            <SidebarGroup>
              <SidebarGroupLabel>기능</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="cursor-pointer"
                      tooltip="검색 (⌘⇧F)"
                      onClick={() => openGlobalSearch(true)}
                    >
                      <Search />
                      <span>검색</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
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
              <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
                시스템
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {system_sidebar_items.map((item) => (
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
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="cursor-pointer"
                      tooltip="설정"
                      onClick={() => {
                        setSettingsMounted(true)
                        setSettingsOpen(true)
                      }}
                    >
                      <Settings />
                      <span>설정</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </ScrollArea>
        </SidebarContent>
        <SidebarFooter>
          <div className="px-0.5">
            <SidebarTrigger />
          </div>
        </SidebarFooter>
      </Sidebar>
      {settingsMounted && (
        <Suspense fallback={null}>
          <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        </Suspense>
      )}
    </>
  )
}

export default MainSidebar

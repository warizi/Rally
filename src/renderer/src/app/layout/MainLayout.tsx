import { SidebarProvider, SidebarTrigger } from '@/shared/ui/sidebar'
import MainSidebar from './MainSidebar'

function MainLayout(): React.JSX.Element {
  return (
    <SidebarProvider>
      <MainSidebar />
      <div className="flex flex-col flex-1 h-screen overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <SidebarTrigger />
        </main>
      </div>
    </SidebarProvider>
  )
}

export default MainLayout

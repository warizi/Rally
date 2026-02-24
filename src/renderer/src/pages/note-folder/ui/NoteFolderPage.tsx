import { TabContainer } from '@/shared/ui/tab-container'
import TabHeader from '@/shared/ui/tab-header'

export function NoteFolderPage(): React.JSX.Element {
  return (
    <TabContainer
      header={<TabHeader title="노트 폴더" description="노트 폴더 관리 페이지입니다." />}
    >
      <div className="text-sm text-muted-foreground">노트 폴더 콘텐츠</div>
    </TabContainer>
  )
}

import { TabContainer } from '@/shared/ui/tab-container'
import TabHeader from '@/shared/ui/tab-header'

export function FolderPage(): React.JSX.Element {
  return (
    <TabContainer
      header={<TabHeader title="파일 탐색기" description="파일 탐색기 관리 페이지입니다." />}
    >
      <div className="text-sm text-muted-foreground">파일 탐색기 콘텐츠</div>
    </TabContainer>
  )
}

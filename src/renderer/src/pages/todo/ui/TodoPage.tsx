import { TabContainer } from '@/shared/ui/tab-container'
import TabHeader from '@/shared/ui/tab-header'

export function TodoPage(): React.JSX.Element {
  return (
    <TabContainer header={<TabHeader title="할 일" description="할 일 관리 페이지입니다." />}>
      <div className="text-sm text-muted-foreground">할 일 콘텐츠</div>
    </TabContainer>
  )
}

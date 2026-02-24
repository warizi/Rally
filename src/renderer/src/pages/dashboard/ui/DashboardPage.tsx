import { TabContainer } from '@/shared/ui/tab-container'
import TabHeader from '@/shared/ui/tab-header'

export function DashboardPage(): React.JSX.Element {
  return (
    <TabContainer header={<TabHeader title="대시보드" description="종합 대시보드입니다." />}>
      <div className="text-sm text-muted-foreground">대시보드 콘텐츠</div>
    </TabContainer>
  )
}

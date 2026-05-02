import { LayoutDashboard, Check, Calendar, Sparkles } from 'lucide-react'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { Button } from '@shared/ui/button'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent
} from '@shared/ui/empty'
import { useWorkspaceIsEmpty } from '@shared/hooks/use-workspace-is-empty'
import { CreateTodoDialog } from '@features/todo/create-todo/ui/CreateTodoDialog'
import { ScheduleFormDialog } from '@features/schedule/manage-schedule'
import {
  TodoStatsCard,
  TodoChartCard,
  NoteChartCard,
  UpcomingTodoCard,
  TodayScheduleCard,
  RecentNotesCard,
  RecentCanvasCard,
  FileOverviewCard,
  QuickActionsCard,
  OnboardingChecklistCard
} from '@widgets/dashboard'

export function DashboardPage(): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const { isEmpty } = useWorkspaceIsEmpty(workspaceId)

  if (!workspaceId) {
    return (
      <TabContainer header={<TabHeader title="대시보드" icon={LayoutDashboard} />}>
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          워크스페이스를 선택해주세요.
        </div>
      </TabContainer>
    )
  }

  if (isEmpty) {
    return (
      <TabContainer
        header={
          <TabHeader
            title="대시보드"
            description="할 일, 일정, 노트를 한눈에 확인하세요."
            icon={LayoutDashboard}
          />
        }
      >
        <div className="flex h-full items-center justify-center py-8">
          <Empty className="border border-dashed max-w-md">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Sparkles className="size-5" />
              </EmptyMedia>
              <EmptyTitle>아직 데이터가 없어요</EmptyTitle>
              <EmptyDescription>
                할 일, 노트, 일정을 만들면 여기에 한눈에 표시됩니다.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <CreateTodoDialog
                  workspaceId={workspaceId}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Check className="size-3" /> 할 일 만들기
                    </Button>
                  }
                />
                <ScheduleFormDialog
                  workspaceId={workspaceId}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Calendar className="size-3" /> 일정 만들기
                    </Button>
                  }
                />
              </div>
            </EmptyContent>
          </Empty>
        </div>
      </TabContainer>
    )
  }

  return (
    <TabContainer
      header={
        <TabHeader
          title="대시보드"
          description="할 일, 일정, 노트를 한눈에 확인하세요."
          icon={LayoutDashboard}
        />
      }
    >
      <div className="grid grid-cols-1 @[400px]:grid-cols-2 @[800px]:grid-cols-3 gap-4 py-4">
        <OnboardingChecklistCard className="@[400px]:col-span-2 @[800px]:col-span-3" />
        <TodoChartCard
          workspaceId={workspaceId}
          className="@[400px]:col-span-2 @[800px]:col-span-2"
        />
        <TodoStatsCard
          workspaceId={workspaceId}
          className="@[400px]:col-span-2 @[800px]:col-span-1"
        />
        <UpcomingTodoCard workspaceId={workspaceId} />
        <TodayScheduleCard workspaceId={workspaceId} />
        <QuickActionsCard
          className="@[400px]:col-span-2 @[800px]:col-span-1"
          workspaceId={workspaceId}
          todoDialogTrigger={
            <CreateTodoDialog
              workspaceId={workspaceId}
              trigger={
                <Button variant="outline" className="h-auto w-full flex-col gap-1 py-3">
                  <Check className="size-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">새 할 일</span>
                </Button>
              }
            />
          }
          scheduleDialogTrigger={
            <ScheduleFormDialog
              workspaceId={workspaceId}
              trigger={
                <Button variant="outline" className="h-auto w-full flex-col gap-1 py-3">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">새 일정</span>
                </Button>
              }
            />
          }
        />

        <NoteChartCard
          workspaceId={workspaceId}
          className="@[400px]:col-span-2 @[800px]:col-span-2"
        />
        <RecentNotesCard workspaceId={workspaceId} />
        <RecentCanvasCard workspaceId={workspaceId} />
        <FileOverviewCard workspaceId={workspaceId} />
      </div>
    </TabContainer>
  )
}

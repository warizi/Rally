import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@shared/ui/switch'
import { Button } from '@shared/ui/button'
import { useTodoDefaultDateSetting } from '@features/todo/create-todo'
import { useShowExtensionSetting } from '@features/folder/manage-folder'
import { useTabHeaderCollapsedSetting } from '@shared/hooks/use-tab-header-collapsed-setting'
import { useOnboardingStore } from '@shared/store/onboarding'

export function GeneralSettings(): React.JSX.Element {
  const { enabled, setEnabled } = useTodoDefaultDateSetting()
  const { enabled: showExtension, setEnabled: setShowExtension } = useShowExtensionSetting()
  const { collapsed: headerCollapsed, setCollapsed: setHeaderCollapsed } =
    useTabHeaderCollapsedSetting()
  const resetWelcome = useOnboardingStore((s) => s.resetWelcome)
  const resetChecklist = useOnboardingStore((s) => s.resetChecklist)
  const [resetting, setResetting] = useState(false)

  const handleResetOnboarding = async (): Promise<void> => {
    setResetting(true)
    try {
      await Promise.all([resetWelcome(), resetChecklist()])
      toast.success(
        '온보딩 상태가 초기화됐어요. 빈 워크스페이스로 전환하면 환영 모달이 다시 표시됩니다.'
      )
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">할일</h3>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm">오늘 날짜 자동 선택</p>
            <p className="text-xs text-muted-foreground">
              할 일 추가 시 시작일·마감일을 오늘 날짜로 자동 설정합니다
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">파일 탐색기</h3>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm">확장자 표시</p>
            <p className="text-xs text-muted-foreground">
              파일 탐색기에서 파일 확장자를 표시합니다
            </p>
          </div>
          <Switch checked={showExtension} onCheckedChange={setShowExtension} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">탭 헤더</h3>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm">기본으로 접기</p>
            <p className="text-xs text-muted-foreground">
              탭을 열 때 헤더를 기본으로 접힌 상태로 표시합니다
            </p>
          </div>
          <Switch checked={headerCollapsed} onCheckedChange={setHeaderCollapsed} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">온보딩</h3>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm">온보딩 다시 보기</p>
            <p className="text-xs text-muted-foreground">
              환영 모달 · 진행 체크리스트 · 미니 팁을 모두 초기화합니다
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleResetOnboarding} disabled={resetting}>
            <Sparkles className="size-3" />
            초기화
          </Button>
        </div>
      </section>
    </div>
  )
}

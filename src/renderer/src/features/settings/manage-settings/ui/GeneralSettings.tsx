import { Switch } from '@shared/ui/switch'
import { useTodoDefaultDateSetting } from '@features/todo/create-todo'

export function GeneralSettings(): React.JSX.Element {
  const { enabled, setEnabled } = useTodoDefaultDateSetting()

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
    </div>
  )
}

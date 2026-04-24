import { Switch } from '@shared/ui/switch'
import { useTodoDefaultDateSetting } from '@features/todo/create-todo'
import { useShowExtensionSetting } from '@features/folder/manage-folder'

export function GeneralSettings(): React.JSX.Element {
  const { enabled, setEnabled } = useTodoDefaultDateSetting()
  const { enabled: showExtension, setEnabled: setShowExtension } = useShowExtensionSetting()

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
    </div>
  )
}

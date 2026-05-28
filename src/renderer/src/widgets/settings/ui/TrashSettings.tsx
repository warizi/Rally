import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { Label } from '@shared/ui/label'
import { Button } from '@shared/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@shared/ui/alert-dialog'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import {
  useTrashCount,
  useTrashRetention,
  TRASH_RETENTION_OPTIONS,
  type TrashRetentionKey
} from '@entities/trash'
import { useEmptyTrash, useSetTrashRetention } from '@features/trash'

export function TrashSettings(): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const retentionQ = useTrashRetention()
  const countQ = useTrashCount(workspaceId)
  const setRetentionM = useSetTrashRetention()
  const emptyM = useEmptyTrash()
  const [pending, setPending] = useState<TrashRetentionKey | null>(null)

  const current = (pending ?? retentionQ.data ?? '30') as TrashRetentionKey

  const handleChange = (value: string): void => {
    const v = value as TrashRetentionKey
    setPending(v)
    setRetentionM.mutate(v, {
      onSettled: () => setPending(null)
    })
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">자동 비우기</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          휴지통 항목을 다음 기간이 지나면 자동으로 영구 삭제합니다.
        </p>
        <RadioGroup value={current} onValueChange={handleChange} className="grid grid-cols-2 gap-2">
          {TRASH_RETENTION_OPTIONS.map((opt) => (
            <Label
              key={opt.value}
              htmlFor={`retention-${opt.value}`}
              className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40 has-[:checked]:bg-muted/60 has-[:checked]:border-primary"
            >
              <RadioGroupItem id={`retention-${opt.value}`} value={opt.value} />
              <span className="text-sm">{opt.label}</span>
            </Label>
          ))}
        </RadioGroup>
        {current === 'never' && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            자동 비우기가 비활성화됐습니다. 휴지통이 무한히 누적될 수 있습니다.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">현재 휴지통</h3>
        <div className="flex items-center justify-between rounded-md border bg-card px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-sm">
              {workspaceId ? `${countQ.data ?? 0}개 항목` : '워크스페이스를 선택해주세요'}
            </p>
            <p className="text-xs text-muted-foreground">
              사이드바 &ldquo;휴지통&rdquo;에서 개별 항목을 복구하거나 삭제할 수 있습니다.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!workspaceId || (countQ.data ?? 0) === 0 || emptyM.isPending}
              >
                지금 비우기
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>휴지통 비우기</AlertDialogTitle>
                <AlertDialogDescription>
                  현재 워크스페이스의 모든 휴지통 항목이 영구 삭제됩니다. 이 작업은 되돌릴 수
                  없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => emptyM.mutate({ workspaceId })}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  모두 삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  )
}

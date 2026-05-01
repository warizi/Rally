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
import { useRemoveSchedule } from '@entities/schedule'

interface Props {
  scheduleId: string
  workspaceId: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteScheduleDialog({
  scheduleId,
  workspaceId,
  trigger,
  open,
  onOpenChange,
  onDeleted
}: Props): React.JSX.Element {
  const removeSchedule = useRemoveSchedule()

  function handleDelete(): void {
    removeSchedule.mutate({ scheduleId, workspaceId }, { onSuccess: onDeleted })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>일정 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            이 일정을 휴지통으로 이동합니다. 휴지통에서 복구하거나 영구 삭제할 수 있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

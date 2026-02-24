import { JSX } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from '@shared/ui/alert-dialog'
import { useDeleteTabSnapshot } from '@entities/tab-snapshot'
import type { TabSnapshot } from '@entities/tab-snapshot'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshot: TabSnapshot | null
}

export function DeleteSnapshotDialog({ open, onOpenChange, snapshot }: Props): JSX.Element {
  const { mutate: deleteSnapshot, isPending } = useDeleteTabSnapshot()

  const handleDelete = (): void => {
    if (!snapshot) return
    deleteSnapshot(snapshot.id, {
      onSuccess: () => onOpenChange(false)
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>스냅샷 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold">{`"${snapshot?.name}"`}</span> 스냅샷을 삭제할까요?
            <br />이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? '삭제 중...' : '삭제'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

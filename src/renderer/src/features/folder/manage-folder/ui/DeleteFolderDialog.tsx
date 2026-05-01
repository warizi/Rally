import { JSX } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@shared/ui/alert-dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderName: string
  onConfirm: () => void
  isPending?: boolean
}

export function DeleteFolderDialog({
  open,
  onOpenChange,
  folderName,
  onConfirm,
  isPending
}: Props): JSX.Element {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>폴더 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold">{`"${folderName}"`}</span> 폴더와 하위 항목이 모두
            휴지통으로 이동됩니다. 휴지통에서 복구하거나 영구 삭제할 수 있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
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

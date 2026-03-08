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
import { useDeleteWorkspace } from '@entities/workspace'
import type { Workspace } from '@entities/workspace'
import { JSX } from 'react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: Workspace | null
  onDeleted: () => void
  disabled: boolean
}

export function DeleteWorkspaceDialog({
  open,
  onOpenChange,
  workspace,
  onDeleted,
  disabled
}: Props): JSX.Element {
  const { mutate: deleteWorkspace, isPending } = useDeleteWorkspace()

  const handleDelete = (): void => {
    if (!workspace || disabled) return
    deleteWorkspace(workspace.id, {
      onSuccess: () => {
        onOpenChange(false)
        onDeleted()
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>워크스페이스 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold">{`"${workspace?.name}"`}</span> 워크스페이스를
            삭제할까요?
            <br /> 워크스페이스에 속한 모든 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending || disabled}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? '삭제 중...' : '삭제'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

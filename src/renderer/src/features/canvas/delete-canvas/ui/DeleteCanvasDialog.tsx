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
import { useRemoveCanvas } from '@entities/canvas'

interface Props {
  canvasId: string
  canvasTitle: string
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteCanvasDialog({
  canvasId,
  canvasTitle,
  workspaceId,
  open,
  onOpenChange,
  onDeleted
}: Props): React.JSX.Element {
  const { mutate: removeCanvas } = useRemoveCanvas()

  function handleDelete(): void {
    removeCanvas({ canvasId, workspaceId }, { onSuccess: onDeleted })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>캔버스 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{canvasTitle}&rdquo; 캔버스를 삭제하시겠습니까? 포함된 모든 노드와 연결이 함께
            삭제됩니다. 이 작업은 되돌릴 수 없습니다.
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

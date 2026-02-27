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
import { useRemoveTodo } from '@entities/todo'

interface Props {
  todoId: string
  workspaceId: string
  hasSubTodos: boolean
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteTodoDialog({
  todoId,
  workspaceId,
  hasSubTodos,
  trigger,
  open,
  onOpenChange,
  onDeleted
}: Props): React.JSX.Element {
  const removeTodo = useRemoveTodo()

  function handleDelete(): void {
    removeTodo.mutate({ workspaceId, todoId }, { onSuccess: onDeleted })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>할 일 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            이 할 일을 삭제하시겠습니까?
            {hasSubTodos && ' 하위 할 일도 함께 삭제됩니다.'}
            {' 이 작업은 되돌릴 수 없습니다.'}
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

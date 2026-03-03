import { toast } from 'sonner'
import { Checkbox } from '@shared/ui/checkbox'
import { useUpdateTodo } from '@entities/todo'

interface Props {
  todoId: string
  workspaceId: string
  checked: boolean
  title?: string
}

export function TodoCheckbox({ todoId, workspaceId, checked, title }: Props): React.JSX.Element {
  const updateTodo = useUpdateTodo()

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(value) =>
        updateTodo.mutate(
          { workspaceId, todoId, data: { isDone: !!value } },
          {
            onSuccess: () => {
              if (value && title) toast.success(`"${title}" 완료!`)
            }
          }
        )
      }
    />
  )
}

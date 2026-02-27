import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@shared/ui/form'
import { Input } from '@shared/ui/input'
import { useUpdateTodo } from '@entities/todo'

const schema = z.object({ title: z.string().min(1, '제목을 입력하세요').max(200) })
type FormValues = z.infer<typeof schema>

interface Props {
  todoId: string
  workspaceId: string
  currentTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditSubTodoDialog({
  todoId,
  workspaceId,
  currentTitle,
  open,
  onOpenChange
}: Props): React.JSX.Element {
  const updateTodo = useUpdateTodo()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: currentTitle }
  })

  useEffect(() => {
    if (open) form.reset({ title: currentTitle })
  }, [open, currentTitle, form])

  function onSubmit(values: FormValues): void {
    updateTodo.mutate(
      { workspaceId, todoId, data: { title: values.title } },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>하위 할 일 수정</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>제목</FormLabel>
                  <FormControl>
                    <Input placeholder="제목을 입력하세요" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={updateTodo.isPending}>
                저장
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

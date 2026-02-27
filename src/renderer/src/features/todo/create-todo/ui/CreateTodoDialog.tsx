import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Form } from '@shared/ui/form'
import { DatePickerButton } from '@shared/ui/date-picker-button'
import { useCreateTodo } from '@entities/todo'
import { TodoFormFields } from './TodoFormFields'
import type { TodoStatus } from '@entities/todo'

const createTodoSchema = z.object({
  title: z.string().min(1, '제목을 입력하세요').max(200),
  description: z.string(),
  status: z.enum(['할일', '진행중', '완료', '보류']),
  priority: z.enum(['high', 'medium', 'low'])
})

type FormValues = z.infer<typeof createTodoSchema>

interface Props {
  workspaceId: string
  parentId?: string | null
  trigger: React.ReactNode
  defaultStatus?: TodoStatus
}

export function CreateTodoDialog({
  workspaceId,
  parentId,
  trigger,
  defaultStatus
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const createTodo = useCreateTodo()
  const titleOnly = !!parentId

  const form = useForm<FormValues>({
    resolver: zodResolver(createTodoSchema),
    defaultValues: {
      title: '',
      description: '',
      status: defaultStatus ?? '할일',
      priority: 'medium'
    }
  })

  function handleOpenChange(next: boolean): void {
    setOpen(next)
    if (next) {
      setDueDate(null)
      form.reset({
        title: '',
        description: '',
        status: defaultStatus ?? '할일',
        priority: 'medium'
      })
    }
  }

  function onSubmit(values: FormValues): void {
    createTodo.mutate(
      {
        workspaceId,
        data: {
          title: values.title,
          description: values.description,
          status: values.status,
          priority: values.priority,
          parentId: parentId ?? null,
          dueDate
        }
      },
      {
        onSuccess: () => {
          setOpen(false)
          setDueDate(null)
          form.reset({
            title: '',
            description: '',
            status: defaultStatus ?? '할일',
            priority: 'medium'
          })
        }
      }
    )
  }

  return (
    <>
      <span onClick={() => handleOpenChange(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{parentId ? '하위 할 일 추가' : '할 일 추가'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <TodoFormFields
                control={form.control}
                errors={form.formState.errors}
                titleOnly={titleOnly}
              />

              {!titleOnly && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">마감일</span>
                  <DatePickerButton
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder="날짜 없음 (선택)"
                    className="w-full"
                  />
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  취소
                </Button>
                <Button type="submit" disabled={createTodo.isPending}>
                  추가
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}

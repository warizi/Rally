import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Form } from '@shared/ui/form'
import { DatePickerButton } from '@shared/ui/date-picker-button'
import { useCreateTodo } from '@entities/todo'
import { useLinkEntity } from '@entities/entity-link'
import { PendingLinkPicker } from '@features/entity-link/manage-link'
import type { PendingLink } from '@features/entity-link/manage-link'
import { ReminderPendingSelect } from '@features/reminder'
import { useSetReminder } from '@entities/reminder'
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
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([])
  const [pendingReminders, setPendingReminders] = useState<number[]>([])
  const createTodo = useCreateTodo()
  const linkEntity = useLinkEntity()
  const setReminder = useSetReminder()
  const titleOnly = !!parentId

  const handleAddLink = useCallback(
    (link: PendingLink) => setPendingLinks((prev) => [...prev, link]),
    []
  )
  const handleRemoveLink = useCallback(
    (link: PendingLink) =>
      setPendingLinks((prev) => prev.filter((l) => !(l.type === link.type && l.id === link.id))),
    []
  )

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
      setStartDate(null)
      setPendingLinks([])
      setPendingReminders([])
      form.reset({
        title: '',
        description: '',
        status: defaultStatus ?? '할일',
        priority: 'medium'
      })
    }
  }

  function onSubmit(values: FormValues): void {
    // 시작일/마감일 시간 기본값 설정
    let finalStart = startDate
    let finalDue = dueDate

    if (finalStart && finalDue) {
      const sameDay =
        finalStart.getFullYear() === finalDue.getFullYear() &&
        finalStart.getMonth() === finalDue.getMonth() &&
        finalStart.getDate() === finalDue.getDate()

      if (sameDay) {
        // 같은 날: 시간 미설정(00:00)이면 09:00-10:00 기본값
        if (finalStart.getHours() === 0 && finalStart.getMinutes() === 0) {
          finalStart = new Date(finalStart)
          finalStart.setHours(9, 0, 0, 0)
        }
        if (finalDue.getHours() === 0 && finalDue.getMinutes() === 0) {
          finalDue = new Date(finalDue)
          finalDue.setHours(10, 0, 0, 0)
        }
      }
    } else if (finalStart && !finalDue) {
      // 시작일만 있으면 마감일 = 시작일 + 1시간
      if (finalStart.getHours() === 0 && finalStart.getMinutes() === 0) {
        finalStart = new Date(finalStart)
        finalStart.setHours(9, 0, 0, 0)
      }
      finalDue = new Date(finalStart)
      finalDue.setHours(finalStart.getHours() + 1, finalStart.getMinutes(), 0, 0)
    } else if (!finalStart && finalDue) {
      // 마감일만 있으면 시작일 = 마감일 - 1시간
      if (finalDue.getHours() === 0 && finalDue.getMinutes() === 0) {
        finalDue = new Date(finalDue)
        finalDue.setHours(10, 0, 0, 0)
      }
      finalStart = new Date(finalDue)
      finalStart.setHours(finalDue.getHours() - 1, finalDue.getMinutes(), 0, 0)
    }

    createTodo.mutate(
      {
        workspaceId,
        data: {
          title: values.title,
          description: values.description,
          status: values.status,
          priority: values.priority,
          parentId: parentId ?? null,
          dueDate: finalDue,
          startDate: finalStart
        }
      },
      {
        onSuccess: (created) => {
          if (created && pendingLinks.length > 0) {
            for (const link of pendingLinks) {
              linkEntity.mutate({
                typeA: 'todo',
                idA: created.id,
                typeB: link.type,
                idB: link.id,
                workspaceId
              })
            }
          }
          if (created && pendingReminders.length > 0) {
            for (const offsetMs of pendingReminders) {
              setReminder.mutate({
                entityType: 'todo',
                entityId: created.id,
                offsetMs
              })
            }
          }
          setOpen(false)
          setDueDate(null)
          setStartDate(null)
          setPendingLinks([])
          setPendingReminders([])
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
                  <span className="text-sm font-medium">시작일</span>
                  <DatePickerButton
                    value={startDate}
                    onChange={(v) => {
                      setStartDate(v)
                      if (!v && !dueDate) setPendingReminders([])
                    }}
                    placeholder="날짜 없음 (선택)"
                    className="w-full"
                  />
                </div>
              )}

              {!titleOnly && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">마감일</span>
                  <DatePickerButton
                    value={dueDate}
                    onChange={(v) => {
                      setDueDate(v)
                      if (!v && !startDate) setPendingReminders([])
                    }}
                    placeholder="날짜 없음 (선택)"
                    className="w-full"
                  />
                </div>
              )}

              {!titleOnly && (startDate || dueDate) && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">알림</span>
                  <ReminderPendingSelect
                    selected={pendingReminders}
                    onChange={setPendingReminders}
                  />
                </div>
              )}

              {!titleOnly && (
                <PendingLinkPicker
                  workspaceId={workspaceId}
                  excludeType="todo"
                  selected={pendingLinks}
                  onAdd={handleAddLink}
                  onRemove={handleRemoveLink}
                />
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

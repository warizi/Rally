import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { startOfDay, endOfDay, setHours, setMinutes } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@shared/ui/form'
import { Input } from '@shared/ui/input'
import { Textarea } from '@shared/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Switch } from '@shared/ui/switch'
import { DatePickerButton } from '@shared/ui/date-picker-button'
import { useCreateSchedule, useUpdateSchedule } from '@entities/schedule'
import type { ScheduleItem } from '@entities/schedule'
import { ColorPicker } from './ColorPicker'

const scheduleSchema = z.object({
  title: z.string().min(1, '제목을 입력하세요').max(200),
  description: z.string(),
  location: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  color: z.string().nullable()
})

type FormValues = z.infer<typeof scheduleSchema>

interface Props {
  workspaceId: string
  trigger?: React.ReactNode
  initialData?: ScheduleItem
  defaultStartDate?: Date
  defaultEndDate?: Date
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

export function ScheduleFormDialog({
  workspaceId,
  trigger,
  initialData,
  defaultStartDate,
  defaultEndDate,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: Props): React.JSX.Element {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  const isEdit = !!initialData
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()

  const [allDay, setAllDay] = useState(initialData?.allDay ?? false)
  const [startDate, setStartDate] = useState<Date | null>(
    initialData?.startAt ?? defaultStartDate ?? new Date()
  )
  const [endDate, setEndDate] = useState<Date | null>(
    initialData?.endAt ?? defaultEndDate ?? new Date()
  )
  const [startHour, setStartHour] = useState(initialData?.startAt.getHours() ?? 9)
  const [startMinute, setStartMinute] = useState(initialData?.startAt.getMinutes() ?? 0)
  const [endHour, setEndHour] = useState(initialData?.endAt.getHours() ?? 10)
  const [endMinute, setEndMinute] = useState(initialData?.endAt.getMinutes() ?? 0)

  const form = useForm<FormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      title: initialData?.title ?? '',
      description: initialData?.description ?? '',
      location: initialData?.location ?? '',
      priority: initialData?.priority ?? 'medium',
      color: initialData?.color ?? null
    }
  })

  useEffect(() => {
    if (open && initialData) {
      form.reset({
        title: initialData.title,
        description: initialData.description ?? '',
        location: initialData.location ?? '',
        priority: initialData.priority,
        color: initialData.color
      })
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAllDay(initialData.allDay)
      setStartDate(initialData.startAt)
      setEndDate(initialData.endAt)
      setStartHour(initialData.startAt.getHours())
      setStartMinute(initialData.startAt.getMinutes())
      setEndHour(initialData.endAt.getHours())
      setEndMinute(initialData.endAt.getMinutes())
    }
  }, [open, initialData, form])

  function handleOpenChange(next: boolean): void {
    setOpen(next)
    if (next && !initialData) {
      form.reset({
        title: '',
        description: '',
        location: '',
        priority: 'medium',
        color: null
      })
      setAllDay(false)
      setStartDate(defaultStartDate ?? new Date())
      setEndDate(defaultEndDate ?? new Date())
      setStartHour(defaultStartDate?.getHours() ?? 9)
      setStartMinute(defaultStartDate?.getMinutes() ?? 0)
      setEndHour(defaultEndDate?.getHours() ?? 10)
      setEndMinute(defaultEndDate?.getMinutes() ?? 0)
    }
  }

  function buildDates(): { startAt: Date; endAt: Date } {
    const sd = startDate ?? new Date()
    const ed = endDate ?? new Date()

    if (allDay) {
      return { startAt: startOfDay(sd), endAt: endOfDay(ed) }
    }

    return {
      startAt: setMinutes(setHours(sd, startHour), startMinute),
      endAt: setMinutes(setHours(ed, endHour), endMinute)
    }
  }

  function onSubmit(values: FormValues): void {
    const { startAt, endAt } = buildDates()

    if (isEdit) {
      updateSchedule.mutate(
        {
          scheduleId: initialData.id,
          workspaceId,
          data: {
            title: values.title,
            description: values.description || null,
            location: values.location || null,
            allDay,
            startAt,
            endAt,
            priority: values.priority,
            color: values.color
          }
        },
        { onSuccess: () => setOpen(false) }
      )
    } else {
      createSchedule.mutate(
        {
          workspaceId,
          data: {
            title: values.title,
            description: values.description || null,
            location: values.location || null,
            allDay,
            startAt,
            endAt,
            priority: values.priority,
            color: values.color
          }
        },
        {
          onSuccess: () => {
            setOpen(false)
            form.reset()
          }
        }
      )
    }
  }

  const isPending = createSchedule.isPending || updateSchedule.isPending

  return (
    <>
      {trigger && <span onClick={() => handleOpenChange(true)}>{trigger}</span>}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? '일정 수정' : '일정 추가'}</DialogTitle>
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
                      <Input placeholder="일정 제목" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-2">
                <Switch checked={allDay} onCheckedChange={setAllDay} />
                <span className="text-sm">종일</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">시작일</span>
                  <DatePickerButton
                    value={startDate}
                    onChange={setStartDate}
                    clearable={false}
                    className="w-full"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">종료일</span>
                  <DatePickerButton
                    value={endDate}
                    onChange={setEndDate}
                    clearable={false}
                    className="w-full"
                  />
                </div>
              </div>

              {!allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">시작 시간</span>
                    <div className="flex gap-1">
                      <Select
                        value={String(startHour)}
                        onValueChange={(v) => setStartHour(Number(v))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {String(h).padStart(2, '0')}시
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={String(startMinute)}
                        onValueChange={(v) => setStartMinute(Number(v))}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MINUTES.map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              {String(m).padStart(2, '0')}분
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">종료 시간</span>
                    <div className="flex gap-1">
                      <Select value={String(endHour)} onValueChange={(v) => setEndHour(Number(v))}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {String(h).padStart(2, '0')}시
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={String(endMinute)}
                        onValueChange={(v) => setEndMinute(Number(v))}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MINUTES.map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              {String(m).padStart(2, '0')}분
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>장소</FormLabel>
                    <FormControl>
                      <Input placeholder="장소 (선택)" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>설명</FormLabel>
                    <FormControl>
                      <Textarea placeholder="설명 (선택)" rows={3} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>우선순위</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high">높음</SelectItem>
                          <SelectItem value="medium">보통</SelectItem>
                          <SelectItem value="low">낮음</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>색상</FormLabel>
                      <ColorPicker value={field.value} onChange={field.onChange} />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  취소
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isEdit ? '수정' : '추가'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Form } from '@shared/ui/form'
import { useCreateRecurringRule, useUpdateRecurringRule } from '@entities/recurring-rule'
import type { RecurringRuleItem } from '@entities/recurring-rule'
import {
  recurringRuleSchema,
  DEFAULT_FORM_VALUES,
  type RecurringRuleFormValues
} from '../model/recurring-rule-form'
import { RecurringRuleFormFields } from './RecurringRuleFormFields'

interface CreateProps {
  mode: 'create'
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface EditProps {
  mode: 'edit'
  workspaceId: string
  rule: RecurringRuleItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Props = CreateProps | EditProps

export function RecurringRuleFormDialog(props: Props): React.JSX.Element {
  const { mode, workspaceId, open, onOpenChange } = props
  const rule = mode === 'edit' ? props.rule : undefined

  const createRule = useCreateRecurringRule()
  const updateRule = useUpdateRecurringRule()

  const form = useForm<RecurringRuleFormValues>({
    resolver: zodResolver(recurringRuleSchema),
    defaultValues: DEFAULT_FORM_VALUES
  })

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && rule) {
        form.reset({
          title: rule.title,
          description: rule.description,
          priority: rule.priority,
          recurrenceType: rule.recurrenceType,
          daysOfWeek: rule.daysOfWeek ?? [],
          startDate: rule.startDate,
          endDate: rule.endDate,
          startTime: rule.startTime,
          endTime: rule.endTime,
          reminderOffsetMs: rule.reminderOffsetMs
        })
      } else {
        form.reset(DEFAULT_FORM_VALUES)
      }
    }
  }, [open, mode, rule, form])

  function onSubmit(values: RecurringRuleFormValues): void {
    if (mode === 'create') {
      createRule.mutate(
        { workspaceId, data: values },
        {
          onSuccess: () => {
            toast.success('반복 할일이 추가되었습니다')
            onOpenChange(false)
          }
        }
      )
    } else {
      updateRule.mutate(
        { workspaceId, ruleId: rule!.id, data: values },
        {
          onSuccess: () => {
            toast.success('반복 할일이 수정되었습니다')
            onOpenChange(false)
          }
        }
      )
    }
  }

  const isPending = createRule.isPending || updateRule.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '반복 할일 추가' : '반복 할일 수정'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <RecurringRuleFormFields control={form.control} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={isPending}>
                {mode === 'create' ? '추가' : '저장'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

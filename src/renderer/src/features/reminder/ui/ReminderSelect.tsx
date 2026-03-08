import { Bell } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Checkbox } from '@shared/ui/checkbox'
import {
  useReminders,
  useSetReminder,
  useRemoveReminder,
  REMINDER_OFFSETS
} from '@entities/reminder'
import type { ReminderItem } from '@entities/reminder'

interface Props {
  entityType: 'todo' | 'schedule'
  entityId: string
  disabled?: boolean
}

export function ReminderSelect({ entityType, entityId, disabled }: Props): React.JSX.Element {
  const { data: reminders = [] } = useReminders(entityType, entityId)
  const setReminder = useSetReminder()
  const removeReminder = useRemoveReminder()

  // offset별 상태: unfired(활성) / fired(발송됨) / 없음
  const reminderByOffset = new Map<number, ReminderItem>(reminders.map((r) => [r.offsetMs, r]))

  const activeCount = reminders.filter((r) => !r.isFired).length

  function handleToggle(offsetMs: number, checked: boolean): void {
    if (checked) {
      setReminder.mutate({ entityType, entityId, offsetMs })
    } else {
      const target = reminderByOffset.get(offsetMs)
      if (target) {
        removeReminder.mutate({ reminderId: target.id, entityType, entityId })
      }
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-1.5">
          <Bell className="size-3.5" />
          {activeCount > 0 ? `${activeCount}개` : '알림'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2">
        <div className="space-y-1.5">
          {REMINDER_OFFSETS.map((opt) => {
            const reminder = reminderByOffset.get(opt.value)
            const isFired = reminder?.isFired === true

            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 cursor-pointer text-sm ${isFired ? 'text-muted-foreground line-through' : ''}`}
              >
                <Checkbox
                  checked={!!reminder}
                  onCheckedChange={(checked) => handleToggle(opt.value, !!checked)}
                />
                {opt.label}
                {isFired && <span className="text-xs text-muted-foreground ml-auto">발송됨</span>}
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

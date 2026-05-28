import { Bell } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Checkbox } from '@shared/ui/checkbox'
import { REMINDER_OFFSETS } from '@entities/reminder'

interface Props {
  selected: number[]
  onChange: (selected: number[]) => void
  disabled?: boolean
}

/** 생성 다이얼로그용: entity가 아직 없으므로 로컬 state로 관리 */
export function ReminderPendingSelect({ selected, onChange, disabled }: Props): React.JSX.Element {
  const activeSet = new Set(selected)

  function handleToggle(value: number, checked: boolean): void {
    if (checked) {
      onChange([...selected, value])
    } else {
      onChange(selected.filter((v) => v !== value))
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-1.5">
          <Bell className="size-3.5" />
          {selected.length > 0 ? `${selected.length}개` : '알림'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2">
        <div className="space-y-1.5">
          {REMINDER_OFFSETS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={activeSet.has(opt.value)}
                onCheckedChange={(checked) => handleToggle(opt.value, !!checked)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

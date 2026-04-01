import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { cn } from '@/shared/lib/utils'

interface Props {
  value: string | null
  onChange: (time: string | null) => void
  placeholder?: string
  className?: string
  clearable?: boolean
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export function TimePickerButton({
  value,
  onChange,
  placeholder = '시간 선택',
  className,
  clearable = true
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)

  const hour = value ? value.split(':')[0] : '09'
  const minute = value ? value.split(':')[1] : '00'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50',
            'flex h-8 w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-sm whitespace-nowrap shadow-xs',
            'transition-[color,box-shadow] outline-none focus-visible:ring-[3px]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="flex-1 text-left">{value ?? placeholder}</span>
          <Clock className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center gap-2">
          <Select
            value={hour}
            onValueChange={(h) => onChange(`${h}:${minute}`)}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="font-medium text-sm">:</span>
          <Select
            value={minute}
            onValueChange={(m) => onChange(`${hour}:${m}`)}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MINUTES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {clearable && value && (
          <div className="mt-2 border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              초기화
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Calendar } from '@/shared/ui/calendar'
import { cn } from '@/shared/lib/utils'

interface Props {
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  className?: string
  clearable?: boolean
}

export function DatePickerButton({
  value,
  onChange,
  placeholder = '날짜 선택',
  className,
  clearable = true
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)

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
          <span className="flex-1 text-left">
            {value ? format(value, 'yyyy.MM.dd') : placeholder}
          </span>
          <CalendarIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(date) => {
            onChange(date ?? null)
            setOpen(false)
          }}
          autoFocus
        />
        {clearable && value && (
          <div className="border-t p-2">
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

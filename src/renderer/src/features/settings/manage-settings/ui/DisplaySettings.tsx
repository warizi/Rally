import { useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { applyTheme, type Theme } from '@/shared/lib/theme'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { useDayViewTimeSettings } from '@/features/schedule/manage-schedule/model/use-day-view-time-settings'

export function DisplaySettings(): React.JSX.Element {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )

  const handleThemeChange = async (theme: Theme): Promise<void> => {
    setCurrentTheme(theme)
    applyTheme(theme)
    await window.api.settings.set('theme', theme)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-4">테마</h3>
        <div className="grid grid-cols-2 gap-4">
          <ThemeCard
            label="라이트"
            theme="light"
            selected={currentTheme === 'light'}
            onClick={() => handleThemeChange('light')}
          />
          <ThemeCard
            label="다크"
            theme="dark"
            selected={currentTheme === 'dark'}
            onClick={() => handleThemeChange('dark')}
          />
        </div>
      </div>

      <Separator />

      <ScheduleSettings />
    </div>
  )
}

function ScheduleSettings(): React.JSX.Element {
  const { settings, updateStartHour, updateEndHour } = useDayViewTimeSettings()

  const handleStartHourChange = (value: string): void => {
    const hour = parseInt(value, 10)
    if (hour < settings.endHour) {
      updateStartHour(hour)
    }
  }

  const handleEndHourChange = (value: string): void => {
    const hour = parseInt(value, 10)
    if (hour > settings.startHour) {
      updateEndHour(hour)
    }
  }

  const formatHour = (h: number): string => `${String(h).padStart(2, '0')}:00`

  return (
    <div>
      <h3 className="text-sm font-medium mb-1">일정</h3>
      <p className="text-xs text-muted-foreground mb-4">일간 뷰 타임라인</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">시작 시간</label>
          <Select value={String(settings.startHour)} onValueChange={handleStartHourChange}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 13 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  {formatHour(i)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">끝 시간</label>
          <Select value={String(settings.endHour)} onValueChange={handleEndHourChange}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 13 }, (_, i) => (
                <SelectItem key={i + 12} value={String(i + 12)}>
                  {formatHour(i + 12)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

function ThemeCard({
  label,
  theme,
  selected,
  onClick
}: {
  label: string
  theme: Theme
  selected: boolean
  onClick: () => void
}): React.JSX.Element {
  const isDark = theme === 'dark'

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition-all flex-1',
        'cursor-pointer hover:border-primary/50',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
      )}
    >
      {/* 스켈레톤 미리보기 */}
      <div
        className={cn(
          'w-full h-24 rounded-md overflow-hidden border',
          isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'
        )}
      >
        {/* 헤더 바 */}
        <div className={cn('h-3', isDark ? 'bg-zinc-800' : 'bg-zinc-100')} />
        <div className="flex h-[calc(100%-12px)]">
          {/* 사이드바 */}
          <div className={cn('w-6', isDark ? 'bg-zinc-800' : 'bg-zinc-50')} />
          {/* 컨텐츠 영역 */}
          <div className="flex-1 p-2 space-y-1.5">
            <div
              className={cn(
                'h-1.5 w-full rounded-full',
                isDark ? 'bg-zinc-700' : 'bg-zinc-200'
              )}
            />
            <div
              className={cn(
                'h-1.5 w-3/4 rounded-full',
                isDark ? 'bg-zinc-700' : 'bg-zinc-200'
              )}
            />
            <div
              className={cn(
                'h-1.5 w-5/6 rounded-full',
                isDark ? 'bg-zinc-700' : 'bg-zinc-200'
              )}
            />
          </div>
        </div>
      </div>

      {/* 레이블 + 체크 표시 */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium">{label}</span>
        {selected && <CheckIcon className="size-3 text-primary" />}
      </div>
    </button>
  )
}

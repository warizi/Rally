import { useEffect, useRef } from 'react'
import { Play } from 'lucide-react'
import { Label } from '@/shared/ui/label'
import { Button } from '@/shared/ui/button'
import { Switch } from '@/shared/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import {
  useToastSettings,
  TOAST_DURATION_OPTIONS,
  TOAST_VISIBLE_COUNT_OPTIONS
} from '@/shared/hooks/use-toast-settings'
import { useAlarmSettingsStore } from '@/shared/store/alarm-settings'
import { ALARM_SOUNDS, getAlarmSoundUrl } from '@/entities/timer'

export function AlarmSettings(): React.JSX.Element {
  const alarmSoundKey = useAlarmSettingsStore((s) => s.alarmSoundKey)
  const setAlarmSoundKey = useAlarmSettingsStore((s) => s.setAlarmSoundKey)
  const alarmRepeat = useAlarmSettingsStore((s) => s.alarmRepeat)
  const setAlarmRepeat = useAlarmSettingsStore((s) => s.setAlarmRepeat)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  // 컴포넌트 unmount 시 미리듣기 사운드 정리
  useEffect(() => {
    return () => {
      const audio = previewAudioRef.current
      if (audio) {
        audio.pause()
        audio.currentTime = 0
        previewAudioRef.current = null
      }
    }
  }, [])

  function handlePreview(): void {
    // 기존 미리듣기 정지 후 새로 재생 (loop 없이 한 번만)
    const prev = previewAudioRef.current
    if (prev) {
      prev.pause()
      prev.currentTime = 0
    }
    const audio = new Audio(getAlarmSoundUrl(alarmSoundKey))
    audio.volume = 0.7
    previewAudioRef.current = audio
    audio.play().catch(() => {
      /* ignore */
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-1">타이머 알림</h3>
        <p className="text-xs text-muted-foreground">
          타이머 종료에서 재생되는 알림 사운드를 선택합니다.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm">알림 사운드</Label>
        <div className="flex gap-2 items-center">
          <Select value={alarmSoundKey} onValueChange={setAlarmSoundKey}>
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALARM_SOUNDS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handlePreview}>
            <Play className="size-3.5 mr-1" />
            미리듣기
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          설정은 즉시 저장되며 다음 알림부터 적용됩니다.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Label className="text-sm">반복 재생</Label>
          <p className="text-xs text-muted-foreground">
            끄면 한 번만 재생됩니다. 켜면 2초 간격으로 반복합니다.
          </p>
        </div>
        <Switch checked={alarmRepeat} onCheckedChange={setAlarmRepeat} />
      </div>

      <Separator />

      <ToastSettings />
    </div>
  )
}

function ToastSettings(): React.JSX.Element {
  const { duration, visibleCount, setDuration, setVisibleCount } = useToastSettings()

  const durationValue = Number.isFinite(duration) ? String(duration) : 'Infinity'

  const handleDurationChange = (value: string): void => {
    setDuration(value === 'Infinity' ? Number.POSITIVE_INFINITY : Number(value))
  }

  const handleVisibleCountChange = (value: string): void => {
    setVisibleCount(Number(value))
  }

  return (
    <div>
      <h3 className="text-sm font-medium mb-1">알림 토스트</h3>
      <p className="text-xs text-muted-foreground mb-4">
        토스트 알림의 자동 닫힘 시간과 동시 표시 개수를 조절합니다. 스택을 초과하면 hover 시
        스크롤로 확인할 수 있습니다.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">자동 닫힘 시간</label>
          <Select value={durationValue} onValueChange={handleDurationChange}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOAST_DURATION_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.label}
                  value={Number.isFinite(opt.value) ? String(opt.value) : 'Infinity'}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">동시 표시 개수</label>
          <Select value={String(visibleCount)} onValueChange={handleVisibleCountChange}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOAST_VISIBLE_COUNT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

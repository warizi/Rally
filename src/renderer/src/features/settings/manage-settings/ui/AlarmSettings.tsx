import { useEffect, useRef } from 'react'
import { Play } from 'lucide-react'
import { Label } from '@/shared/ui/label'
import { Button } from '@/shared/ui/button'
import { Switch } from '@/shared/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
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
        <h2 className="text-base font-semibold mb-1">알림</h2>
        <p className="text-sm text-muted-foreground">
          타이머 종료 등에서 재생되는 알림 사운드를 선택합니다.
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
    </div>
  )
}

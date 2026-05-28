/**
 * 타이머 알람 다이얼로그.
 *
 * 루트 layout 에 mount 되어 타이머 페이지 unmount 후에도 timer store 의
 * `alarmActive` 가 true 가 되면 즉시 다이얼로그를 표시하고 사운드를 재생한다.
 *
 * 사운드 재생 정책:
 * - alarmRepeat = false → 한 번만 재생 후 정지 (다이얼로그는 dismiss 까지 유지)
 * - alarmRepeat = true → 재생 종료 후 ALARM_REPEAT_INTERVAL_MS (2초) 대기 → 재시작 반복
 */
import { useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { useTimerStore, getAlarmSoundUrl } from '@/entities/timer'
import { useAlarmSettingsStore, ALARM_REPEAT_INTERVAL_MS } from '@features/timer/manage-alarm'

export function TimerAlarmDialog(): React.JSX.Element {
  const alarmActive = useTimerStore((s) => s.alarmActive)
  const dismissAlarm = useTimerStore((s) => s.dismissAlarm)
  const alarmSoundKey = useAlarmSettingsStore((s) => s.alarmSoundKey)
  const alarmRepeat = useAlarmSettingsStore((s) => s.alarmRepeat)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function cleanup(): void {
      if (repeatTimerRef.current !== null) {
        clearTimeout(repeatTimerRef.current)
        repeatTimerRef.current = null
      }
      const audio = audioRef.current
      if (audio) {
        audio.onended = null
        audio.pause()
        audio.currentTime = 0
        audio.src = ''
        audioRef.current = null
      }
    }

    if (!alarmActive) {
      cleanup()
      return
    }

    const url = getAlarmSoundUrl(alarmSoundKey)
    // 무음 사운드: 다이얼로그만 표시, 재생 X
    if (!url) return cleanup

    function playOnce(): void {
      const audio = new Audio(url)
      audio.volume = 0.7
      audioRef.current = audio
      if (alarmRepeat) {
        // 한 회 재생 종료 후 2초 대기 → 다시 재생 반복
        audio.onended = () => {
          repeatTimerRef.current = setTimeout(() => {
            repeatTimerRef.current = null
            playOnce()
          }, ALARM_REPEAT_INTERVAL_MS)
        }
      }
      audio.play().catch(() => {
        /* Electron 에선 보통 발생 안 함 */
      })
    }

    playOnce()
    return cleanup
  }, [alarmActive, alarmSoundKey, alarmRepeat])

  return (
    <Dialog
      open={alarmActive}
      onOpenChange={(open) => {
        if (!open) dismissAlarm()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>타이머 종료</DialogTitle>
          <DialogDescription>설정한 시간이 종료되었습니다.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button autoFocus onClick={dismissAlarm}>
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

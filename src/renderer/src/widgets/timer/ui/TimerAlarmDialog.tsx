/**
 * 타이머 알람 다이얼로그.
 *
 * 루트 layout 에 mount 되어 타이머 페이지 unmount 후에도 timer store 의
 * `alarmActive` 가 true 가 되면 즉시 다이얼로그를 표시하고 사운드를 재생한다.
 *
 * 핵심:
 * - audio 는 useRef 로 관리, alarmActive true → play(loop), false → pause + reset
 * - 사운드 URL 은 설정 store 의 alarmSoundKey 로 매핑
 * - 사용자가 "확인" 누르면 dismissAlarm() → 다이얼로그 + 사운드 정지
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
import { useAlarmSettingsStore } from '@/shared/store/alarm-settings'

export function TimerAlarmDialog(): React.JSX.Element {
  const alarmActive = useTimerStore((s) => s.alarmActive)
  const dismissAlarm = useTimerStore((s) => s.dismissAlarm)
  const alarmSoundKey = useAlarmSettingsStore((s) => s.alarmSoundKey)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!alarmActive) {
      // 다이얼로그 닫힘 → 사운드 정지/정리
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.currentTime = 0
        audio.src = ''
        audioRef.current = null
      }
      return
    }
    // 알람 활성 → 새 Audio 생성 + 재생
    const audio = new Audio(getAlarmSoundUrl(alarmSoundKey))
    audio.loop = true
    audio.volume = 0.7
    audioRef.current = audio
    audio.play().catch(() => {
      // Electron 환경에서는 autoplay policy 영향 거의 없으나, 안전상 catch.
    })
    return () => {
      audio.pause()
      audio.currentTime = 0
    }
  }, [alarmActive, alarmSoundKey])

  return (
    <Dialog
      open={alarmActive}
      // 외부 클릭 / ESC 등으로 닫혀도 사운드는 dismissAlarm 로 통일 처리
      onOpenChange={(open) => {
        if (!open) dismissAlarm()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>⏰ 타이머 종료</DialogTitle>
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

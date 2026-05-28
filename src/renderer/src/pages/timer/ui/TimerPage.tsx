import { useState } from 'react'
import { useTimerStore, TIMER_MIN_DURATION_MS } from '@/entities/timer'
import { Button } from '@/shared/ui/button'
import { Play, Pause, RotateCcw, Settings } from 'lucide-react'
import { TabContainer } from '@/shared/ui/tab-container'
import TabHeader from '@/shared/ui/tab-header'
import { TimerSettingsDialog } from './TimerSettingsDialog'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function msToHms(ms: number): { h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60
  }
}

function TimerPage(): React.JSX.Element {
  const durationMs = useTimerStore((s) => s.durationMs)
  const remainingMs = useTimerStore((s) => s.remainingMs)
  const isRunning = useTimerStore((s) => s.isRunning)
  const pausedRemainingMs = useTimerStore((s) => s.pausedRemainingMs)
  const alarmActive = useTimerStore((s) => s.alarmActive)
  const start = useTimerStore((s) => s.start)
  const pause = useTimerStore((s) => s.pause)
  const resume = useTimerStore((s) => s.resume)
  const reset = useTimerStore((s) => s.reset)

  const [settingsOpen, setSettingsOpen] = useState(false)

  const display = msToHms(remainingMs)
  const canStart = durationMs >= TIMER_MIN_DURATION_MS
  const isPaused = !isRunning && pausedRemainingMs != null && pausedRemainingMs > 0
  const canOpenSettings = !isRunning && !alarmActive

  return (
    <TabContainer
      scrollable={false}
      header={
        <TabHeader
          title="타이머"
          buttons={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              disabled={!canOpenSettings}
            >
              <Settings className="size-4 mr-1.5" />
              시간 설정
            </Button>
          }
        />
      }
    >
      <div className="flex flex-col items-center justify-center gap-8 px-6 max-w-3xl mx-auto h-full">
        {/* 디지털 카운트 */}
        <div className="font-mono text-5xl @[400px]:text-6xl tabular-nums tracking-tight select-none">
          {pad(display.h)}:{pad(display.m)}:{pad(display.s)}
        </div>

        {/* 제약 안내 */}
        {!canStart && !isRunning && !isPaused && (
          <p className="text-xs text-muted-foreground">시간을 설정해주세요. (최소 5초)</p>
        )}

        {/* 버튼 세트 */}
        <div className="flex items-center gap-2">
          {!isRunning && !isPaused && (
            <Button onClick={start} disabled={!canStart} size="lg">
              <Play className="size-4 mr-1.5" />
              시작
            </Button>
          )}
          {isRunning && (
            <Button onClick={pause} size="lg" variant="secondary">
              <Pause className="size-4 mr-1.5" />
              일시정지
            </Button>
          )}
          {isPaused && (
            <Button onClick={resume} size="lg">
              <Play className="size-4 mr-1.5" />
              재개
            </Button>
          )}
          <Button onClick={reset} size="lg" variant="outline" disabled={alarmActive}>
            <RotateCcw className="size-4 mr-1.5" />
            초기화
          </Button>
        </div>
      </div>

      <TimerSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </TabContainer>
  )
}

export default TimerPage

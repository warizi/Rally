import { useTimerStore, TIMER_MIN_DURATION_MS } from '@/entities/timer'
import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Play, Pause, RotateCcw, TimerIcon } from 'lucide-react'
import { TabContainer } from '@/shared/ui/tab-container'

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

function hmsToMs(h: number, m: number, s: number): number {
  return ((h * 60 + m) * 60 + s) * 1000
}

// Select options: 0~23 시 / 0~59 분 / 0~59 초
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)
const SECONDS = Array.from({ length: 60 }, (_, i) => i)

function TimerPage(): React.JSX.Element {
  const durationMs = useTimerStore((s) => s.durationMs)
  const remainingMs = useTimerStore((s) => s.remainingMs)
  const isRunning = useTimerStore((s) => s.isRunning)
  const pausedRemainingMs = useTimerStore((s) => s.pausedRemainingMs)
  const alarmActive = useTimerStore((s) => s.alarmActive)
  const setDuration = useTimerStore((s) => s.setDuration)
  const start = useTimerStore((s) => s.start)
  const pause = useTimerStore((s) => s.pause)
  const resume = useTimerStore((s) => s.resume)
  const reset = useTimerStore((s) => s.reset)

  // 설정 입력은 정지 상태일 때만 활성화
  const settingDisabled = isRunning || alarmActive
  const { h, m, s } = msToHms(durationMs)

  function handleSelectChange(part: 'h' | 'm' | 's', value: string): void {
    const n = parseInt(value, 10)
    const next = { h, m, s, [part]: n }
    setDuration(hmsToMs(next.h, next.m, next.s))
  }

  const display = msToHms(remainingMs)
  const canStart = durationMs >= TIMER_MIN_DURATION_MS
  const isPaused = !isRunning && pausedRemainingMs != null && pausedRemainingMs > 0

  return (
    <TabContainer
      header={
        <div className="flex items-center gap-2">
          <TimerIcon className="size-5" />
          <h1 className="text-xl font-semibold">타이머</h1>
        </div>
      }
    >
      <div className="flex flex-col items-center justify-center gap-8 py-12 px-6 max-w-3xl mx-auto">
        {/* 디지털 카운트 */}
        <div className="font-mono text-7xl @[400px]:text-8xl tabular-nums tracking-tight select-none">
          {pad(display.h)}:{pad(display.m)}:{pad(display.s)}
        </div>

        {/* 설정 picker — 정지 상태에서만 활성 */}
        <div className="flex items-center gap-2">
          <Select
            value={String(h)}
            onValueChange={(v) => handleSelectChange('h', v)}
            disabled={settingDisabled}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((v) => (
                <SelectItem key={v} value={String(v)}>
                  {v}시
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(m)}
            onValueChange={(v) => handleSelectChange('m', v)}
            disabled={settingDisabled}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MINUTES.map((v) => (
                <SelectItem key={v} value={String(v)}>
                  {v}분
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(s)}
            onValueChange={(v) => handleSelectChange('s', v)}
            disabled={settingDisabled}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECONDS.map((v) => (
                <SelectItem key={v} value={String(v)}>
                  {v}초
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 제약 안내 */}
        {!canStart && !isRunning && !isPaused && (
          <p className="text-xs text-muted-foreground">최소 5초 이상으로 설정해주세요.</p>
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
    </TabContainer>
  )
}

export default TimerPage

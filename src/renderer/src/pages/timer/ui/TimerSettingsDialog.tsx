import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useTimerStore, TIMER_MIN_DURATION_MS } from '@/entities/timer'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)
const SECONDS = Array.from({ length: 60 }, (_, i) => i)

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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TimerSettingsDialog({ open, onOpenChange }: Props): React.JSX.Element {
  const durationMs = useTimerStore((s) => s.durationMs)
  const setDuration = useTimerStore((s) => s.setDuration)

  // 다이얼로그 안에서는 draft 로 들고있다가 확인 시 commit.
  const initial = msToHms(durationMs)
  const [h, setH] = useState(initial.h)
  const [m, setM] = useState(initial.m)
  const [s, setS] = useState(initial.s)

  function handleOpenChange(next: boolean): void {
    if (next) {
      const cur = msToHms(useTimerStore.getState().durationMs)
      setH(cur.h)
      setM(cur.m)
      setS(cur.s)
    }
    onOpenChange(next)
  }

  function handleConfirm(): void {
    setDuration(hmsToMs(h, m, s))
    onOpenChange(false)
  }

  const draftMs = hmsToMs(h, m, s)
  const canConfirm = draftMs >= TIMER_MIN_DURATION_MS

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>시간 설정</DialogTitle>
          <DialogDescription>최소 5초 이상, 최대 24시간까지 설정할 수 있습니다.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Label className="text-sm">시 / 분 / 초</Label>
          <div className="flex items-center gap-2">
            <Select value={String(h)} onValueChange={(v) => setH(parseInt(v, 10))}>
              <SelectTrigger className="w-24">
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
            <Select value={String(m)} onValueChange={(v) => setM(parseInt(v, 10))}>
              <SelectTrigger className="w-24">
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
            <Select value={String(s)} onValueChange={(v) => setS(parseInt(v, 10))}>
              <SelectTrigger className="w-24">
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
          {!canConfirm && <p className="text-xs text-destructive">5초 이상으로 설정해주세요.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

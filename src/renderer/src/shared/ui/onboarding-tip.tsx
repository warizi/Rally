import { useEffect, useState } from 'react'
import { Lightbulb, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover'
import { Button } from '@shared/ui/button'
import { useOnboardingStore } from '@shared/store/onboarding'
import { cn } from '@shared/lib/utils'

interface OnboardingTipProps {
  /** 고유 ID — onboarding.tipsShown 키에 기록 */
  tipId: string
  title: string
  description: string
  /** 팁 trigger anchor — 보통 trigger element를 children으로 감쌈 */
  children: React.ReactNode
  /** 자동 표시 (mount 시) — 한 번도 안 본 경우만. 기본 true */
  autoOpen?: boolean
  /** popover 위치 */
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

export function OnboardingTip({
  tipId,
  title,
  description,
  children,
  autoOpen = true,
  side = 'bottom',
  align = 'center'
}: OnboardingTipProps): React.JSX.Element {
  const hydrated = useOnboardingStore((s) => s.hydrated)
  const tipsShown = useOnboardingStore((s) => s.tipsShown)
  const markTipShown = useOnboardingStore((s) => s.markTipShown)

  const alreadyShown = tipsShown.includes(tipId)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    if (alreadyShown) return
    if (!autoOpen) return
    // hydrate 후 한 번 mount 되었을 때 open
    const t = setTimeout(() => setOpen(true), 250)
    return () => clearTimeout(t)
  }, [hydrated, alreadyShown, autoOpen])

  const handleDismiss = (): void => {
    setOpen(false)
    markTipShown(tipId).catch(console.error)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) handleDismiss()
        else setOpen(true)
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-72 p-3">
        <div className="flex items-start gap-2.5">
          <div className="rounded-full bg-primary/10 p-1.5 text-primary">
            <Lightbulb className="size-3.5" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium leading-tight">{title}</h3>
              <Button
                variant="ghost"
                size="icon"
                className="-mt-1 -mr-1 size-5 shrink-0"
                onClick={handleDismiss}
                title="다시 보지 않기"
              >
                <X className="size-3" />
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface OnboardingTipIconProps {
  tipId: string
  title: string
  description: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  className?: string
}

/**
 * 페이지 헤더 등에 두는 미니 팁 아이콘.
 * - 첫 mount 시 자동으로 popover 열림
 * - 사용자가 닫으면 tipsShown 기록 → 이후 mount 시 자동 열림 안 함
 * - 그러나 아이콘 자체는 계속 보이며 클릭 시 다시 표시 가능
 */
export function OnboardingTipIcon({
  tipId,
  title,
  description,
  side = 'bottom',
  align = 'end',
  className
}: OnboardingTipIconProps): React.JSX.Element {
  return (
    <OnboardingTip
      tipId={tipId}
      title={title}
      description={description}
      side={side}
      align={align}
    >
      <button
        type="button"
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-accent hover:text-foreground transition-colors',
          className
        )}
        title="도움말"
        aria-label="도움말"
      >
        <Lightbulb className="size-3.5" />
      </button>
    </OnboardingTip>
  )
}

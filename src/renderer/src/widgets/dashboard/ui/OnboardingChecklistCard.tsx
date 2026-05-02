import { useEffect, useRef } from 'react'
import { Check, PartyPopper, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  CHECKLIST_STEPS,
  selectChecklistCounts,
  useOnboardingStore,
  type ChecklistStep
} from '@shared/store/onboarding'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { Button } from '@shared/ui/button'
import { DashboardCard } from '@shared/ui/dashboard-card'
import { TAB_ICON, type TabType } from '@shared/constants/tab-url'

const PATHNAME_TO_TAB: Record<string, { type: TabType; title: string }> = {
  '/folder': { type: 'folder', title: '파일 탐색기' },
  '/todo': { type: 'todo', title: '할 일' },
  '/canvas': { type: 'canvas', title: '캔버스' },
  '/calendar': { type: 'calendar', title: '캘린더' },
  '/trash': { type: 'trash', title: '휴지통' }
}

interface Props {
  className?: string
}

export function OnboardingChecklistCard({ className }: Props): React.JSX.Element | null {
  const hydrated = useOnboardingStore((s) => s.hydrated)
  const acknowledged = useOnboardingStore((s) => s.checklistAcknowledged)
  const progress = useOnboardingStore((s) => s.checklistProgress)
  const acknowledgeChecklist = useOnboardingStore((s) => s.acknowledgeChecklist)
  const openTab = useTabStore((s) => s.openTab)

  const counts = selectChecklistCounts({
    welcomeDismissed: false,
    checklistProgress: progress,
    tipsShown: [],
    checklistAcknowledged: acknowledged,
    hydrated
  })

  const celebratedRef = useRef(false)
  useEffect(() => {
    if (!hydrated) return
    if (acknowledged) return
    if (counts.isAllDone && !celebratedRef.current) {
      celebratedRef.current = true
      toast.success('🎉 온보딩 완료! 모든 단계를 마쳤어요.', { duration: 4000 })
    }
  }, [hydrated, counts.isAllDone, acknowledged])

  if (!hydrated) return null
  if (acknowledged) return null

  const handleStepClick = (step: ChecklistStep): void => {
    const tabInfo = PATHNAME_TO_TAB[step.pathname]
    if (tabInfo) {
      openTab({ type: tabInfo.type, pathname: step.pathname, title: tabInfo.title })
    }
    // /tag, /settings/ai 등 별도 라우트가 없는 경우는 사이드바·설정에서 직접 진입
  }

  const handleClose = (): void => {
    acknowledgeChecklist().catch(console.error)
  }

  const ratio = counts.done / counts.total

  return (
    <DashboardCard
      title={counts.isAllDone ? '🎉 다 끝났어요' : '시작하기'}
      icon={counts.isAllDone ? PartyPopper : Sparkles}
      action={
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={handleClose}
          title="이 위젯 숨기기"
        >
          <X className="size-3.5" />
        </Button>
      }
      className={className}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {counts.done}/{counts.total}
          </span>
        </div>

        <ul className="flex flex-col gap-1">
          {CHECKLIST_STEPS.map((step) => (
            <ChecklistRow
              key={step.id}
              step={step}
              done={!!progress[step.id]}
              onClick={() => handleStepClick(step)}
            />
          ))}
        </ul>
      </div>
    </DashboardCard>
  )
}

function ChecklistRow({
  step,
  done,
  onClick
}: {
  step: ChecklistStep
  done: boolean
  onClick: () => void
}): React.JSX.Element {
  const tabInfo = PATHNAME_TO_TAB[step.pathname]
  const Icon = tabInfo ? TAB_ICON[tabInfo.type] : undefined

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
          done ? 'text-muted-foreground' : ''
        }`}
      >
        <span
          className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
            done
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/40'
          }`}
        >
          {done && <Check className="size-3" />}
        </span>
        {Icon && <Icon className="size-3.5 shrink-0 opacity-60" />}
        <span className={`flex-1 truncate ${done ? 'line-through' : ''}`}>{step.label}</span>
      </button>
    </li>
  )
}

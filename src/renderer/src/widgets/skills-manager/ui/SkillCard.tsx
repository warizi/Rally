import { LockIcon, SparklesIcon, UserIcon } from 'lucide-react'
import { Badge } from '@shared/ui/badge'
import { cn } from '@shared/lib/utils'
import type { SkillItem } from '@entities/skill'

interface SkillCardProps {
  skill: SkillItem
  applied: boolean
  /** UI overlay slot — 액션 버튼 (apply/edit/delete 등) 이 후속 단계에서 주입됨. */
  actions?: React.ReactNode
  onClick?: () => void
}

export function SkillCard({ skill, applied, actions, onClick }: SkillCardProps): React.JSX.Element {
  const isSystem = skill.source === 'system'

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        'border rounded-md px-3 py-2.5 text-sm',
        'transition-colors',
        applied ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-background hover:bg-accent/30',
        onClick && 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="font-medium font-mono text-[13px]">{skill.name}</span>
            {isSystem ? (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <SparklesIcon className="size-2.5" /> 기본
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <UserIcon className="size-2.5" /> 커스텀
              </Badge>
            )}
            {applied && (
              <Badge
                variant="outline"
                className="gap-1 text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              >
                ✓ 적용됨
              </Badge>
            )}
            {!skill.editable && (
              <span title="기본 skill 은 수정·삭제할 수 없습니다" className="text-muted-foreground">
                <LockIcon className="size-3" />
              </span>
            )}
          </div>
          {skill.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
              {skill.description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>
    </div>
  )
}

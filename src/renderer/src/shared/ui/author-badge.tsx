import { Bot } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/shared/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import {
  formatAuthorTooltip,
  type AuthorKind
} from '@/shared/lib/format-author'
function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#D97757"
        fillRule="nonzero"
        d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"
      />
    </svg>
  )
}

function UserRoundPenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M2 21a8 8 0 0 1 10.821-7.487" />
      <path d="M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />
      <circle cx={10} cy={8} r={5} />
    </svg>
  )
}

const ICON_SIZE: Record<'sm' | 'md', string> = {
  sm: 'size-3',
  md: 'size-3.5'
}

const WRAPPER_SIZE: Record<'sm' | 'md', string> = {
  sm: 'size-5',
  md: 'size-6'
}

interface BadgeIconProps {
  by: AuthorKind
  byId: string | null
  at?: Date | string | number
  action: 'created' | 'updated'
  size: 'sm' | 'md'
  className?: string
}

function pickIcon(by: AuthorKind, byId: string | null) {
  if (by === 'user') return UserRoundPenIcon
  if (byId && byId.toLowerCase().includes('claude')) return ClaudeIcon
  return Bot
}

/**
 * 단일 아이콘 + 툴팁. 부모에 TooltipProvider 가 있어야 한다.
 * 동그란 흰색 배경 위에 아이콘.
 */
function BadgeIcon({ by, byId, at, action, size, className }: BadgeIconProps) {
  const Icon = pickIcon(by, byId)
  const tooltipText = formatAuthorTooltip(by, byId, at, action)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-white/80 dark:bg-white/10 border border-border/40 text-foreground/80 shadow-sm',
            WRAPPER_SIZE[size],
            className
          )}
          aria-label={tooltipText}
        >
          <Icon className={cn(ICON_SIZE[size])} aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  )
}

interface AuthorBadgeProps {
  by: AuthorKind
  byId: string | null
  at?: Date | string | number
  action?: 'created' | 'updated'
  size?: 'sm' | 'md'
  className?: string
}

/** 간이 표시 — 단일 actor 아이콘 + 툴팁. 기본은 수정자(updated). */
export function AuthorBadge({
  by,
  byId,
  at,
  action = 'updated',
  size = 'sm',
  className
}: AuthorBadgeProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <BadgeIcon
        by={by}
        byId={byId}
        at={at}
        action={action}
        size={size}
        className={className}
      />
    </TooltipProvider>
  )
}

interface AuthorBadgePairProps {
  createdBy: AuthorKind
  createdById: string | null
  createdAt?: Date | string | number
  updatedBy: AuthorKind
  updatedById: string | null
  updatedAt?: Date | string | number
  size?: 'sm' | 'md'
  className?: string
}

/**
 * 상세 표시 — 생성자 + 수정자 두 아이콘. 라벨 없이 아이콘만.
 * 같은 actor + 같은 시각(= 미수정)이면 한 아이콘만 표시.
 */
export function AuthorBadgePair({
  createdBy,
  createdById,
  createdAt,
  updatedBy,
  updatedById,
  updatedAt,
  size = 'sm',
  className
}: AuthorBadgePairProps) {
  const sameActor = createdBy === updatedBy && createdById === updatedById
  const sameTime =
    createdAt && updatedAt
      ? new Date(createdAt).getTime() === new Date(updatedAt).getTime()
      : !createdAt && !updatedAt

  return (
    <TooltipProvider delayDuration={300}>
      {sameActor && sameTime ? (
        <BadgeIcon
          by={updatedBy}
          byId={updatedById}
          at={updatedAt ?? createdAt}
          action="updated"
          size={size}
          className={className}
        />
      ) : (
        <span className={cn('inline-flex items-center', className)}>
          <BadgeIcon
            by={createdBy}
            byId={createdById}
            at={createdAt}
            action="created"
            size={size}
          />
          <BadgeIcon
            by={updatedBy}
            byId={updatedById}
            at={updatedAt}
            action="updated"
            size={size}
            className="-ml-1.5 hover:z-10"
          />
        </span>
      )}
    </TooltipProvider>
  )
}

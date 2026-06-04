import { Bot } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import { formatAuthorTooltip, type AuthorKind } from '@/shared/lib/format-author'
import { useShowAuthorBadgeSetting } from '@/shared/hooks/use-show-author-badge-setting'
function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fill="#D97757"
        fillRule="nonzero"
        d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"
      />
    </svg>
  )
}

function OpenAIIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 721 721" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fill="currentColor"
        d="M304.246 294.611V249.028C304.246 245.189 305.687 242.309 309.044 240.392L400.692 187.612C413.167 180.415 428.042 177.058 443.394 177.058C500.971 177.058 537.44 221.682 537.44 269.182C537.44 272.54 537.44 276.379 536.959 280.218L441.954 224.558C436.197 221.201 430.437 221.201 424.68 224.558L304.246 294.611ZM518.245 472.145V363.224C518.245 356.505 515.364 351.707 509.608 348.349L389.174 278.296L428.519 255.743C431.877 253.826 434.757 253.826 438.115 255.743L529.762 308.523C556.154 323.879 573.905 356.505 573.905 388.171C573.905 424.636 552.315 458.225 518.245 472.141V472.145ZM275.937 376.182L236.592 353.152C233.235 351.235 231.794 348.354 231.794 344.515V238.956C231.794 187.617 271.139 148.749 324.4 148.749C344.555 148.749 363.264 155.468 379.102 167.463L284.578 222.164C278.822 225.521 275.942 230.319 275.942 237.039V376.186L275.937 376.182ZM360.626 425.122L304.246 393.455V326.283L360.626 294.616L417.002 326.283V393.455L360.626 425.122ZM396.852 570.989C376.698 570.989 357.989 564.27 342.151 552.276L436.674 497.574C442.431 494.217 445.311 489.419 445.311 482.699V343.552L485.138 366.582C488.495 368.499 489.936 371.379 489.936 375.219V480.778C489.936 532.117 450.109 570.985 396.852 570.985V570.989ZM283.134 463.99L191.486 411.211C165.094 395.854 147.343 363.229 147.343 331.562C147.343 294.616 169.415 261.509 203.48 247.593V356.991C203.48 363.71 206.361 368.508 212.117 371.866L332.074 441.437L292.729 463.99C289.372 465.907 286.491 465.907 283.134 463.99ZM277.859 542.68C223.639 542.68 183.813 501.895 183.813 451.514C183.813 447.675 184.294 443.836 184.771 439.997L279.295 494.698C285.051 498.056 290.812 498.056 296.568 494.698L417.002 425.127V470.71C417.002 474.549 415.562 477.429 412.204 479.346L320.557 532.126C308.081 539.323 293.206 542.68 277.854 542.68H277.859ZM396.852 599.776C454.911 599.776 503.37 558.513 514.41 503.812C568.149 489.896 602.696 439.515 602.696 388.176C602.696 354.587 588.303 321.962 562.392 298.45C564.791 288.373 566.231 278.296 566.231 268.224C566.231 199.611 510.571 148.267 446.274 148.267C433.322 148.267 420.846 150.184 408.37 154.505C386.775 133.392 357.026 119.958 324.4 119.958C266.342 119.958 217.883 161.22 206.843 215.921C153.104 229.837 118.557 280.218 118.557 331.557C118.557 365.146 132.95 397.771 158.861 421.283C156.462 431.36 155.022 441.437 155.022 451.51C155.022 520.123 210.682 571.466 274.978 571.466C287.931 571.466 300.407 569.549 312.883 565.228C334.473 586.341 364.222 599.776 396.852 599.776Z"
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

// Claude / OpenAI(Codex) 브랜드 로고는 원 안에서 작아 보여 한 단계 크게.
const ICON_SIZE_BRAND: Record<'sm' | 'md', string> = {
  sm: 'size-3.5',
  md: 'size-4'
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
  const id = byId?.toLowerCase() ?? ''
  if (id.includes('claude')) return ClaudeIcon
  if (id.includes('codex') || id.includes('chatgpt') || id.includes('openai')) return OpenAIIcon
  return Bot
}

/** Claude / OpenAI(Codex) 브랜드 로고인지 — 이 경우만 아이콘을 크게 표시 */
function isBrandIcon(by: AuthorKind, byId: string | null): boolean {
  if (by !== 'ai') return false
  const id = byId?.toLowerCase() ?? ''
  return (
    id.includes('claude') ||
    id.includes('codex') ||
    id.includes('chatgpt') ||
    id.includes('openai')
  )
}

/**
 * 단일 아이콘 + 툴팁. 부모에 TooltipProvider 가 있어야 한다.
 * 동그란 흰색 배경 위에 아이콘.
 */
function BadgeIcon({ by, byId, at, action, size, className }: BadgeIconProps) {
  const Icon = pickIcon(by, byId)
  const iconSize = isBrandIcon(by, byId) ? ICON_SIZE_BRAND[size] : ICON_SIZE[size]
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
          <Icon className={cn(iconSize)} aria-hidden />
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
  const { show } = useShowAuthorBadgeSetting()
  if (!show) return null
  return (
    <TooltipProvider delayDuration={300}>
      <BadgeIcon by={by} byId={byId} at={at} action={action} size={size} className={className} />
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
  const { show } = useShowAuthorBadgeSetting()
  const sameActor = createdBy === updatedBy && createdById === updatedById
  const sameTime =
    createdAt && updatedAt
      ? new Date(createdAt).getTime() === new Date(updatedAt).getTime()
      : !createdAt && !updatedAt

  if (!show) return null

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

import { Repeat } from 'lucide-react'
import { Checkbox } from '@shared/ui/checkbox'
import { Badge } from '@shared/ui/badge'
import { TruncateTooltip } from '@shared/ui/truncate-tooltip'
import type { RecurringRuleItem } from '@entities/recurring-rule'
import type { RecurringCompletionItem } from '@entities/recurring-completion'
import { useCompleteRecurring, useUncompleteRecurring } from '@entities/recurring-completion'

const PRIORITY_DOT: Record<string, string> = {
  high: 'text-rose-400',
  medium: 'text-amber-400',
  low: 'text-sky-400'
}

const PRIORITY_CLASS: Record<string, string> = {
  high: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
  medium:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  low: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800'
}

const PRIORITY_LABEL: Record<string, string> = { high: '높음', medium: '보통', low: '낮음' }

interface RowProps {
  rule: RecurringRuleItem
  completion: RecurringCompletionItem | undefined
  workspaceId: string
  date: Date
}

function RecurringTodoRow({ rule, completion, workspaceId, date }: RowProps): React.JSX.Element {
  const completeRecurring = useCompleteRecurring()
  const uncompleteRecurring = useUncompleteRecurring()
  const isDone = !!completion

  function handleCheck(checked: boolean): void {
    if (checked) {
      completeRecurring.mutate({ workspaceId, ruleId: rule.id, date })
    } else if (completion) {
      uncompleteRecurring.mutate({ workspaceId, completionId: completion.id, date })
    }
  }

  return (
    <div className="flex items-center gap-2 py-2 px-2 border-b border-border last:border-0 hover:bg-muted/50">
      <Checkbox checked={isDone} onCheckedChange={handleCheck} />
      <TruncateTooltip content={rule.title}>
        <span
          className={`flex-1 text-sm truncate min-w-0 ${isDone ? 'line-through text-muted-foreground' : ''}`}
        >
          {rule.title}
        </span>
      </TruncateTooltip>
      {(rule.startTime || rule.endTime) && (
        <span className="text-xs text-muted-foreground shrink-0">
          {rule.startTime}
          {rule.endTime ? `~${rule.endTime}` : ''}
        </span>
      )}
      <Badge
        variant="outline"
        className={`hidden @[400px]:inline-flex shrink-0 border ${PRIORITY_CLASS[rule.priority]}`}
      >
        {PRIORITY_LABEL[rule.priority]}
      </Badge>
      <span
        className={`h-2 w-2 rounded-full shrink-0 @[400px]:hidden ${PRIORITY_DOT[rule.priority].replace('text-', 'bg-')}`}
      />
    </div>
  )
}

interface Props {
  rules: RecurringRuleItem[]
  completions: RecurringCompletionItem[]
  workspaceId: string
  date: Date
}

export function RecurringTodoView({
  rules,
  completions,
  workspaceId,
  date
}: Props): React.JSX.Element {
  if (rules.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-1.5">
        <Repeat className="size-4 opacity-50" />
        <span>오늘 반복 할일이 없습니다</span>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      {rules.map((rule) => {
        const completion = completions.find((c) => c.ruleId === rule.id)
        return (
          <RecurringTodoRow
            key={rule.id}
            rule={rule}
            completion={completion}
            workspaceId={workspaceId}
            date={date}
          />
        )
      })}
    </div>
  )
}

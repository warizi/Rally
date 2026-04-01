import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { CollapsibleSection } from '@shared/ui/collapsible-section'
import { RecurringTodoView } from '@features/todo/todo-list/ui/RecurringTodoView'
import { ManageRecurringDialog } from '@features/todo/manage-recurring/ui/ManageRecurringDialog'
import { useRecurringRulesToday } from '@entities/recurring-rule'
import { useRecurringCompletionsToday } from '@entities/recurring-completion'

interface Props {
  workspaceId: string
  date: Date
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function RecurringTodoSection({
  workspaceId,
  date,
  open,
  onOpenChange
}: Props): React.JSX.Element {
  const [manageOpen, setManageOpen] = useState(false)
  const { data: rules = [] } = useRecurringRulesToday(workspaceId, date)
  const { data: completions = [] } = useRecurringCompletionsToday(workspaceId, date)

  return (
    <>
      <CollapsibleSection
        title={`반복 할일 (${rules.length}개)`}
        open={open}
        onOpenChange={onOpenChange}
        contentClassName="max-h-36 overflow-y-auto"
        headerExtra={
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2 gap-1"
            onClick={() => setManageOpen(true)}
          >
            <Settings2 className="size-3" />
            관리
          </Button>
        }
      >
        <RecurringTodoView
          rules={rules}
          completions={completions}
          workspaceId={workspaceId}
          date={date}
        />
      </CollapsibleSection>

      <ManageRecurringDialog
        workspaceId={workspaceId}
        open={manageOpen}
        onOpenChange={setManageOpen}
      />
    </>
  )
}

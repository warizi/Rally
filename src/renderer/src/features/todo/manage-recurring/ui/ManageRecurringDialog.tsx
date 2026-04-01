import { useState } from 'react'
import { CalendarRange, Clock, MoreHorizontal, Repeat } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@shared/ui/dialog'
import { Badge } from '@shared/ui/badge'
import { Button } from '@shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@shared/ui/alert-dialog'
import { useRecurringRulesByWorkspace, useDeleteRecurringRule } from '@entities/recurring-rule'
import type { RecurringRuleItem } from '@entities/recurring-rule'
import { RECURRENCE_TYPE_LABELS, DAY_LABELS } from '../model/recurring-rule-form'
import { RecurringRuleFormDialog } from './RecurringRuleFormDialog'

interface Props {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PRIORITY_CLASS: Record<string, string> = {
  high: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
  medium: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  low: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800'
}
const PRIORITY_LABEL: Record<string, string> = { high: '높음', medium: '보통', low: '낮음' }

function formatRecurrence(rule: RecurringRuleItem): string {
  if (rule.recurrenceType === 'custom' && rule.daysOfWeek) {
    const days = rule.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')
    return `매주 ${days}`
  }
  return RECURRENCE_TYPE_LABELS[rule.recurrenceType] ?? rule.recurrenceType
}

function formatPeriod(rule: RecurringRuleItem): string {
  const start = rule.startDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
  if (!rule.endDate) return `${start}~`
  const end = rule.endDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
  return `${start} ~ ${end}`
}

export function ManageRecurringDialog({
  workspaceId,
  open,
  onOpenChange
}: Props): React.JSX.Element {
  const { data: rules = [] } = useRecurringRulesByWorkspace(workspaceId)
  const deleteRule = useDeleteRecurringRule()

  const [editTarget, setEditTarget] = useState<RecurringRuleItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RecurringRuleItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  function handleDelete(): void {
    if (!deleteTarget) return
    deleteRule.mutate(
      { workspaceId, ruleId: deleteTarget.id },
      {
        onSuccess: () => {
          toast.success('반복 할일이 삭제되었습니다. 완료 이력은 유지됩니다.')
          setDeleteTarget(null)
        }
      }
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[80vh]">
          <div className="flex items-center gap-3">
            <DialogTitle>반복 할일 관리</DialogTitle>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              + 새 반복 할일
            </Button>
          </div>

          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
              <Repeat className="size-8 opacity-30" />
              <p>등록된 반복 할일이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-y-auto min-h-0 divide-y divide-border">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-start justify-between py-3 gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`border ${PRIORITY_CLASS[rule.priority]}`}
                      >
                        {PRIORITY_LABEL[rule.priority]}
                      </Badge>
                      <p className="text-sm font-medium leading-snug">{rule.title}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {formatRecurrence(rule)}
                      </span>
                      <CalendarRange className="size-3 shrink-0" />
                      <span>{formatPeriod(rule)}</span>
                      {(rule.startTime || rule.endTime) && (
                        <>
                          <Clock className="size-3 shrink-0" />
                          <span>
                            {rule.startTime}
                            {rule.endTime ? ` ~ ${rule.endTime}` : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditTarget(rule)}>수정</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setDeleteTarget(rule)}
                      >
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 생성 Dialog */}
      <RecurringRuleFormDialog
        mode="create"
        workspaceId={workspaceId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {/* 수정 Dialog */}
      {editTarget && (
        <RecurringRuleFormDialog
          mode="edit"
          workspaceId={workspaceId}
          rule={editTarget}
          open={!!editTarget}
          onOpenChange={(o) => {
            if (!o) setEditTarget(null)
          }}
        />
      )}

      {/* 삭제 확인 Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>반복 할일 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; 반복 규칙이 삭제됩니다.
              <br />
              완료 이력은 유지됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

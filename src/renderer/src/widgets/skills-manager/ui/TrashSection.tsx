import { JSX, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDownIcon, Loader2Icon, RotateCcwIcon, Trash2Icon, TrashIcon } from 'lucide-react'
import { Button } from '@shared/ui/button'
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
import { cn } from '@shared/lib/utils'
import { usePurgeSkill, useRestoreSkill, useTrashedSkills, type SkillItem } from '@entities/skill'

export function TrashSection(): JSX.Element {
  const [open, setOpen] = useState(false)
  const trashedQuery = useTrashedSkills()
  const restore = useRestoreSkill()
  const purge = usePurgeSkill()
  const [confirmPurge, setConfirmPurge] = useState<SkillItem | null>(null)

  const trashed = trashedQuery.data ?? []

  const handleRestore = async (skill: SkillItem): Promise<void> => {
    try {
      await restore.mutateAsync({ id: skill.id })
      toast.success(`${skill.name} 복구됨`, {
        description: '다시 적용하려면 "적용" 버튼을 눌러주세요.'
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '복구에 실패했습니다'
      toast.error(message)
    }
  }

  const handlePurge = async (skill: SkillItem): Promise<void> => {
    try {
      await purge.mutateAsync({ id: skill.id })
      toast.success(`${skill.name} 영구 삭제됨`)
      setConfirmPurge(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : '영구 삭제에 실패했습니다'
      toast.error(message)
    }
  }

  return (
    <section className="space-y-1.5">
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDownIcon className={cn('size-3 transition-transform', open ? '' : '-rotate-90')} />
        <TrashIcon className="size-3" />
        휴지통 ({trashed.length})
      </button>

      {open && (
        <>
          {trashed.length === 0 ? (
            <div className="border border-dashed rounded-md px-3 py-3 text-xs text-muted-foreground text-center">
              휴지통이 비어 있습니다.
            </div>
          ) : (
            <div className="space-y-1.5">
              {trashed.map((skill) => (
                <div
                  key={skill.id}
                  className="border rounded-md px-3 py-2 flex items-start justify-between gap-3 bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[13px] font-medium">{skill.name}</div>
                    {skill.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {skill.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 gap-1 text-xs"
                      onClick={() => handleRestore(skill)}
                      disabled={restore.isPending}
                      title="복구"
                    >
                      {restore.isPending ? (
                        <Loader2Icon className="size-3 animate-spin" />
                      ) : (
                        <>
                          <RotateCcwIcon className="size-3" />
                          복구
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setConfirmPurge(skill)}
                      title="영구 삭제"
                    >
                      <Trash2Icon className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <AlertDialog
        open={confirmPurge !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmPurge(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <span className="font-mono">{confirmPurge?.name}</span> 을(를) 영구 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 복구하려면 대신 "복구" 버튼을 누르세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={purge.isPending}
              onClick={() => confirmPurge && handlePurge(confirmPurge)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {purge.isPending ? (
                <>
                  <Loader2Icon className="size-3 animate-spin mr-1" />
                  삭제 중…
                </>
              ) : (
                '영구 삭제'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

import { JSX, useState } from 'react'
import { toast } from 'sonner'
import { Loader2Icon, Trash2Icon } from 'lucide-react'
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
import { useRemoveSkill, type SkillItem } from '@entities/skill'

interface Props {
  skill: SkillItem
}

export function RemoveSkillButton({ skill }: Props): JSX.Element | null {
  const removeMutation = useRemoveSkill()
  const [open, setOpen] = useState(false)

  // 기본 skill 은 삭제 불가 — 버튼 자체 미노출.
  if (!skill.editable) return null

  const handleConfirm = async (): Promise<void> => {
    try {
      await removeMutation.mutateAsync({ id: skill.id })
      toast.success(`${skill.name} 을(를) 삭제했습니다.`)
      setOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : '삭제에 실패했습니다'
      toast.error(message)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
        title="삭제"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <Trash2Icon className="size-3" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <span className="font-mono">{skill.name}</span> 을(를) 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              DB 에서 영구 삭제되며, 적용된{' '}
              <code className="bg-muted px-1 rounded text-xs">~/.claude/skills/{skill.name}/</code>{' '}
              디렉터리도 함께 정리됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeMutation.isPending}
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMutation.isPending ? (
                <>
                  <Loader2Icon className="size-3 animate-spin mr-1" />
                  삭제 중…
                </>
              ) : (
                '삭제'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

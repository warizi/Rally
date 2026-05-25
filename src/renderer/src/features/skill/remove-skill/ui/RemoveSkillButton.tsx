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
  if (skill.source === 'system') return null

  const handleConfirm = async (): Promise<void> => {
    try {
      await removeMutation.mutateAsync({ id: skill.id })
      toast.success(`${skill.name} 을(를) 휴지통으로 이동했습니다.`)
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
        {/*
          React synthetic event 는 portal 무관하게 React tree 를 따라 bubble 한다.
          이 AlertDialog 는 RemoveSkillButton (SkillCard 의 action slot) 안에 있으므로
          내부 클릭 (취소/확인) 이 SkillCard onClick (상세 다이얼로그 열기) 으로 새어나가지 않게
          모든 click 을 여기서 차단.
        */}
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <span className="font-mono">{skill.name}</span> 을(를) 휴지통으로 이동할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              적용된{' '}
              <code className="bg-muted px-1 rounded text-xs">~/.claude/skills/{skill.name}/</code>{' '}
              디렉터리는 함께 정리됩니다. 휴지통에서 복구하거나 영구 삭제할 수 있습니다.
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
                  이동 중…
                </>
              ) : (
                '휴지통으로'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

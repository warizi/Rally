import { JSX, useState } from 'react'
import { toast } from 'sonner'
import { CheckIcon, DownloadIcon, Loader2Icon, TrashIcon } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { useApplySkill, useUnapplySkill, type SkillItem } from '@entities/skill'

interface Props {
  skill: SkillItem
  applied: boolean
}

export function ApplyToggleButton({ skill, applied }: Props): JSX.Element {
  const applyMutation = useApplySkill()
  const unapplyMutation = useUnapplySkill()
  const [hovering, setHovering] = useState(false)

  const isPending = applyMutation.isPending || unapplyMutation.isPending

  const handleClick = async (e: React.MouseEvent): Promise<void> => {
    // SkillCard 의 onClick (상세 다이얼로그 오픈) 으로 버블링 차단.
    e.stopPropagation()
    try {
      if (applied) {
        await unapplyMutation.mutateAsync({ id: skill.id })
        toast.success(`${skill.name} 적용을 해제했습니다.`)
      } else {
        await applyMutation.mutateAsync({ id: skill.id })
        toast.success(`${skill.name} 을(를) 적용했습니다.`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '작업에 실패했습니다'
      toast.error(message)
    }
  }

  if (isPending) {
    return (
      <Button size="sm" variant="ghost" disabled className="h-7 px-2 gap-1 text-xs">
        <Loader2Icon className="size-3 animate-spin" />
      </Button>
    )
  }

  if (applied) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={handleClick}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className="h-7 px-2 gap-1 text-xs hover:bg-destructive/10 hover:text-destructive"
        title="적용 해제"
      >
        {hovering ? (
          <>
            <TrashIcon className="size-3" />
            해제
          </>
        ) : (
          <>
            <CheckIcon className="size-3 text-emerald-500" />
            적용됨
          </>
        )}
      </Button>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      className="h-7 px-2 gap-1 text-xs"
      title="Claude 에 적용 (~/.claude/skills 에 SKILL.md 작성)"
    >
      <DownloadIcon className="size-3" />
      적용
    </Button>
  )
}

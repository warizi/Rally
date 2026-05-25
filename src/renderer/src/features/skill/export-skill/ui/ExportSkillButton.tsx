import { JSX, useState } from 'react'
import { toast } from 'sonner'
import { DownloadCloudIcon, Loader2Icon } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { SkillItem } from '@entities/skill'

interface Props {
  skill: SkillItem
}

/**
 * `.skill` (ZIP) 파일로 내보내기. Claude Desktop / Claude.ai 에 수동 업로드용.
 */
export function ExportSkillButton({ skill }: Props): JSX.Element {
  const [busy, setBusy] = useState(false)

  const handleClick = async (e: React.MouseEvent): Promise<void> => {
    // SkillCard onClick (상세 다이얼로그 오픈) 차단
    e.stopPropagation()
    setBusy(true)
    try {
      const res: IpcResponse<{ path: string } | null> = await window.api.skill.export(skill.id)
      if (!res.success) throwIpcError(res)
      if (!res.data) return // 사용자가 dialog 취소
      toast.success(`${skill.name}.skill 저장됨`, {
        description: 'Claude Desktop 의 Settings > Skills 에서 업로드하세요.'
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '내보내기에 실패했습니다'
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={handleClick}
          className="h-7 px-2 gap-1 text-xs"
        >
          {busy ? (
            <Loader2Icon className="size-3 animate-spin" />
          ) : (
            <DownloadCloudIcon className="size-3" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">.skill 파일로 내보내기</p>
        <p className="text-muted-foreground">Claude Desktop 업로드용 ZIP</p>
      </TooltipContent>
    </Tooltip>
  )
}

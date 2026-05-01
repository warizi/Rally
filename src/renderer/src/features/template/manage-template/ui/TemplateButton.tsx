import { JSX, useState } from 'react'
import { FileStack, Save, FolderOpen } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Button } from '@shared/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@shared/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@shared/ui/alert-dialog'
import type { TemplateType } from '@entities/template'
import { SaveTemplateDialog } from './SaveTemplateDialog'
import { LoadTemplateDialog } from './LoadTemplateDialog'

interface Props {
  workspaceId: string
  type: TemplateType
  /** 현재 컨텐츠를 직렬화하여 반환. 빈 컨텐츠는 null/빈 문자열 반환 */
  getJsonData: () => string | null
  /** 현재 본문이 비어있지 않은지 여부 — 불러오기 시 덮어쓰기 경고 표시용 */
  hasContent: boolean
  /** 템플릿 적용 시 호출. jsonData를 받아 본문에 적용 */
  onApply: (jsonData: string) => void
}

export function TemplateButton({
  workspaceId,
  type,
  getJsonData,
  hasContent,
  onApply
}: Props): JSX.Element {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [loadOpen, setLoadOpen] = useState(false)
  const [emptyAlertOpen, setEmptyAlertOpen] = useState(false)
  const [pendingJsonData, setPendingJsonData] = useState<string | null>(null)

  const handleSaveClick = (): void => {
    const data = getJsonData()
    if (!data || data.trim() === '') {
      setPopoverOpen(false)
      setEmptyAlertOpen(true)
      return
    }
    setPendingJsonData(data)
    setSaveOpen(true)
    setPopoverOpen(false)
  }

  const handleLoadClick = (): void => {
    setLoadOpen(true)
    setPopoverOpen(false)
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7">
                <FileStack className="size-3.5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>템플릿</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-44 p-1">
          <button
            type="button"
            onClick={handleSaveClick}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left hover:bg-accent transition-colors"
          >
            <Save className="size-3.5 text-muted-foreground" />
            <span>현재 구성 저장</span>
          </button>
          <button
            type="button"
            onClick={handleLoadClick}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left hover:bg-accent transition-colors"
          >
            <FolderOpen className="size-3.5 text-muted-foreground" />
            <span>템플릿 불러오기</span>
          </button>
        </PopoverContent>
      </Popover>

      <SaveTemplateDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        workspaceId={workspaceId}
        type={type}
        jsonData={pendingJsonData ?? ''}
      />

      <LoadTemplateDialog
        open={loadOpen}
        onOpenChange={setLoadOpen}
        workspaceId={workspaceId}
        type={type}
        hasContent={hasContent}
        onApply={onApply}
      />

      <AlertDialog open={emptyAlertOpen} onOpenChange={setEmptyAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>저장할 내용이 비어있습니다</AlertDialogTitle>
            <AlertDialogDescription>
              내용을 작성한 뒤 다시 시도해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

import type { JSX } from 'react'
import { FilePlus, FolderPlus, Sheet } from 'lucide-react'
import { Button } from '@shared/ui/button'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent
} from '@shared/ui/empty'

interface Props {
  onCreateNote: () => void
  onCreateCsv: () => void
  onCreateFolder: () => void
}

/**
 * 워크스페이스에 아무 항목도 없을 때 보여주는 안내 + quick action.
 */
export function FolderTreeEmpty({ onCreateNote, onCreateCsv, onCreateFolder }: Props): JSX.Element {
  return (
    <Empty className="border border-dashed mt-2">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderPlus className="size-5" />
        </EmptyMedia>
        <EmptyTitle className="text-sm">첫 노트를 만들어보세요</EmptyTitle>
        <EmptyDescription className="text-xs">노트, 표, 폴더로 시작하세요.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={onCreateNote}>
            <FilePlus className="size-3" /> 노트
          </Button>
          <Button size="sm" variant="outline" onClick={onCreateCsv}>
            <Sheet className="size-3" /> 표
          </Button>
          <Button size="sm" variant="outline" onClick={onCreateFolder}>
            <FolderPlus className="size-3" /> 폴더
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}

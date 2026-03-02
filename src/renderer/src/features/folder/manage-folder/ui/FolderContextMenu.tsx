import { JSX } from 'react'
import { FileText, FolderPlus, ImageIcon, Palette, Pencil, Sheet, FileUp, Trash2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@shared/ui/context-menu'

interface Props {
  children: React.ReactNode
  onCreateChild: () => void
  onCreateNote: () => void
  onCreateCsv: () => void
  onImportPdf: () => void
  onImportImage: () => void
  onRename: () => void
  onEditColor: () => void
  onDelete: () => void
}

export function FolderContextMenu({
  children,
  onCreateChild,
  onCreateNote,
  onCreateCsv,
  onImportPdf,
  onImportImage,
  onRename,
  onEditColor,
  onDelete
}: Props): JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={onCreateChild}>
          <FolderPlus className="size-4 mr-2" />
          하위 폴더 생성
        </ContextMenuItem>
        <ContextMenuItem onClick={onCreateNote}>
          <FileText className="size-4 mr-2" />
          노트 추가하기
        </ContextMenuItem>
        <ContextMenuItem onClick={onCreateCsv}>
          <Sheet className="size-4 mr-2" />
          테이블 추가하기
        </ContextMenuItem>
        <ContextMenuItem onClick={onImportPdf}>
          <FileUp className="size-4 mr-2" />
          PDF 가져오기
        </ContextMenuItem>
        <ContextMenuItem onClick={onImportImage}>
          <ImageIcon className="size-4 mr-2" />
          이미지 가져오기
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onRename}>
          <Pencil className="size-4 mr-2" />
          이름 변경
        </ContextMenuItem>
        <ContextMenuItem onClick={onEditColor}>
          <Palette className="size-4 mr-2" />
          색상 변경
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4 mr-2" />
          삭제
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

import { JSX, useState } from 'react'
import {
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  ImageIcon,
  Palette,
  Pencil,
  Sheet,
  FileUp,
  Trash2
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@shared/ui/context-menu'

interface Props {
  children: React.ReactNode
  name: string
  color: string | null
  onCreateChild: () => void
  onCreateNote: () => void
  onImportNote: () => void
  onCreateCsv: () => void
  onImportCsv: () => void
  onImportPdf: () => void
  onImportImage: () => void
  onRename: () => void
  onEditColor: () => void
  onDelete: () => void
}

type OpenSub = 'note' | 'table' | null

export function FolderContextMenu({
  children,
  name,
  color,
  onCreateChild,
  onCreateNote,
  onImportNote,
  onCreateCsv,
  onImportCsv,
  onImportPdf,
  onImportImage,
  onRename,
  onEditColor,
  onDelete
}: Props): JSX.Element {
  const [openSub, setOpenSub] = useState<OpenSub>(null)

  const handleSiblingEnter = (next: OpenSub) => () => {
    if (openSub && openSub !== next) setOpenSub(null)
  }

  return (
    <ContextMenu onOpenChange={(open) => !open && setOpenSub(null)}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuLabel className="flex items-center gap-1.5 text-muted-foreground text-xs font-normal">
          <Folder className="size-3 shrink-0" style={{ color: color ?? undefined }} />
          <span className="truncate">{name}</span>
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuLabel className="text-muted-foreground text-xs font-normal">
            추가
          </ContextMenuLabel>
          <ContextMenuItem onClick={onCreateChild} onPointerEnter={handleSiblingEnter(null)}>
            <FolderPlus className="size-4 mr-2" />
            하위 폴더 생성
          </ContextMenuItem>
          <ContextMenuSub
            open={openSub === 'note'}
            onOpenChange={(open) =>
              setOpenSub(open ? 'note' : openSub === 'note' ? null : openSub)
            }
          >
            <ContextMenuSubTrigger onPointerEnter={() => setOpenSub('note')}>
              <FileText className="size-4 mr-2" />
              노트
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-40">
              <ContextMenuItem onClick={onImportNote}>
                <FileUp className="size-4 mr-2" />
                노트 가져오기
              </ContextMenuItem>
              <ContextMenuItem onClick={onCreateNote}>
                <FilePlus className="size-4 mr-2" />
                노트 추가하기
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub
            open={openSub === 'table'}
            onOpenChange={(open) =>
              setOpenSub(open ? 'table' : openSub === 'table' ? null : openSub)
            }
          >
            <ContextMenuSubTrigger onPointerEnter={() => setOpenSub('table')}>
              <Sheet className="size-4 mr-2" />
              테이블
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-40">
              <ContextMenuItem onClick={onCreateCsv}>
                <FilePlus className="size-4 mr-2" />
                테이블 추가하기
              </ContextMenuItem>
              <ContextMenuItem onClick={onImportCsv}>
                <FileUp className="size-4 mr-2" />
                테이블 가져오기
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem onClick={onImportPdf} onPointerEnter={handleSiblingEnter(null)}>
            <FileUp className="size-4 mr-2" />
            PDF 가져오기
          </ContextMenuItem>
          <ContextMenuItem onClick={onImportImage} onPointerEnter={handleSiblingEnter(null)}>
            <ImageIcon className="size-4 mr-2" />
            이미지 가져오기
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuLabel className="text-muted-foreground text-xs font-normal">
            편집
          </ContextMenuLabel>
          <ContextMenuItem onClick={onRename} onPointerEnter={handleSiblingEnter(null)}>
            <Pencil className="size-4 mr-2" />
            이름 변경
          </ContextMenuItem>
          <ContextMenuItem onClick={onEditColor} onPointerEnter={handleSiblingEnter(null)}>
            <Palette className="size-4 mr-2" />
            색상 변경
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem
            variant="destructive"
            onClick={onDelete}
            onPointerEnter={handleSiblingEnter(null)}
          >
            <Trash2 className="size-4 mr-2" />
            삭제
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}

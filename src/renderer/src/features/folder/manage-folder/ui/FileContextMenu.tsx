import { JSX } from 'react'
import { Copy, FileText, ImageIcon, Sheet, Trash2, type LucideIcon } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@shared/ui/context-menu'

type FileKind = 'note' | 'csv' | 'pdf' | 'image'

const ICON_BY_KIND: Record<FileKind, LucideIcon> = {
  note: FileText,
  csv: Sheet,
  pdf: FileText,
  image: ImageIcon
}

interface Props {
  children: React.ReactNode
  name: string
  kind: FileKind
  onDuplicate: () => void
  onDelete: () => void
}

export function FileContextMenu({
  children,
  name,
  kind,
  onDuplicate,
  onDelete
}: Props): JSX.Element {
  const Icon = ICON_BY_KIND[kind]
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuLabel className="flex items-center gap-1.5 text-muted-foreground text-xs font-normal">
          <Icon className="size-3 shrink-0" />
          <span className="truncate">{name}</span>
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem onClick={onDuplicate}>
            <Copy className="size-4 mr-2" />
            복사
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="size-4 mr-2" />
            삭제
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}

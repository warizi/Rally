import { JSX } from 'react'
import { LayoutGrid } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@shared/ui/sidebar'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@shared/ui/context-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/ui/tooltip'
import type { TabSnapshot } from '@entities/tab-snapshot'
import { TabSnapshotPreview } from './TabSnapshotPreview'

interface Props {
  snapshot: TabSnapshot
  onRestore: () => void
  onOverwrite: () => void
  onEdit: () => void
  onDelete: () => void
}

export function TabSnapshotItem({
  snapshot,
  onRestore,
  onOverwrite,
  onEdit,
  onDelete
}: Props): JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <SidebarMenuItem>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton className="cursor-pointer" onClick={onRestore}>
                  <LayoutGrid className="h-4 w-4 shrink-0" />
                  <span className="truncate">{snapshot.name}</span>
                </SidebarMenuButton>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-popover text-popover-foreground w-[160px] border p-2 shadow-md"
              >
                <TabSnapshotPreview snapshot={snapshot} />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </SidebarMenuItem>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onOverwrite}>현재 탭으로 저장</ContextMenuItem>
        <ContextMenuItem onClick={onEdit}>수정</ContextMenuItem>
        <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          삭제
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

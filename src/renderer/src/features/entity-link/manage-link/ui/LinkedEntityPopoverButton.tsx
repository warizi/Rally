import { useCallback, useState } from 'react'
import { Link } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Button } from '@shared/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@shared/ui/tooltip'
import { useLinkedEntities } from '@entities/entity-link'
import { useTodosByWorkspace } from '@entities/todo'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import type { LinkableEntityType } from '@shared/lib/entity-link'
import { toTabOptions } from '../lib/to-tab-options'
import { LinkedEntityList } from './LinkedEntityList'
import { LinkEntityPopover } from './LinkEntityPopover'
import { OpenAllSubmenu } from './OpenAllSubmenu'

interface Props {
  entityType: LinkableEntityType
  entityId: string
  workspaceId: string
}

export function LinkedEntityPopoverButton({
  entityType,
  entityId,
  workspaceId
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const { data: linked = [] } = useLinkedEntities(entityType, entityId)
  const { data: todos = [] } = useTodosByWorkspace(workspaceId)
  const openTab = useTabStore((s) => s.openTab)
  const closeTabByPathname = useTabStore((s) => s.closeTabByPathname)

  const resolveTabOptions = useCallback(
    (linkedType: LinkableEntityType, linkedId: string) => {
      const item = linked.find((l) => l.entityType === linkedType && l.entityId === linkedId)
      const parentId = linkedType === 'todo' ? todos.find((t) => t.id === linkedId)?.parentId : null
      return toTabOptions(linkedType, linkedId, item?.title ?? '', parentId)
    },
    [linked, todos]
  )

  const handleNavigate = useCallback(
    (linkedType: LinkableEntityType, linkedId: string) => {
      const options = resolveTabOptions(linkedType, linkedId)
      if (options) openTab(options)
    },
    [resolveTabOptions, openTab]
  )

  const handleOpenInPane = useCallback(
    (linkedType: LinkableEntityType, linkedId: string, paneId: string) => {
      const options = resolveTabOptions(linkedType, linkedId)
      if (options) {
        closeTabByPathname(options.pathname)
        openTab(options, paneId)
      }
      setOpen(false)
    },
    [resolveTabOptions, openTab, closeTabByPathname]
  )

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setLinkOpen(false)
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 relative">
              <Link className="size-3.5" />
              {linked.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center">
                  {linked.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>연결된 항목</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">연결된 항목</span>
          <LinkEntityPopover
            entityType={entityType}
            entityId={entityId}
            workspaceId={workspaceId}
            open={linkOpen}
            onOpenChange={setLinkOpen}
          >
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
              {linkOpen ? '닫기' : '+ 연결 추가'}
            </Button>
          </LinkEntityPopover>
        </div>
        <LinkedEntityList
          entityType={entityType}
          entityId={entityId}
          onNavigate={handleNavigate}
          onOpenInPane={handleOpenInPane}
        />
        {linked.length > 1 && (
          <div className="border-t mt-2 pt-1">
            <OpenAllSubmenu linked={linked} todos={todos} onDone={() => setOpen(false)} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

import { useCallback, useState } from 'react'
import { Link } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Button } from '@shared/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@shared/ui/tooltip'
import { useLinkedEntities } from '@entities/entity-link'
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
  const { data: linked = [] } = useLinkedEntities(entityType, entityId)
  const openTab = useTabStore((s) => s.openTab)

  const handleNavigate = useCallback(
    (linkedType: LinkableEntityType, linkedId: string) => {
      const item = linked.find((l) => l.entityType === linkedType && l.entityId === linkedId)
      const options = toTabOptions(linkedType, linkedId, item?.title ?? '')
      if (options) openTab(options)
    },
    [linked, openTab]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
            onClose={() => setOpen(false)}
          >
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
              + 연결 추가
            </Button>
          </LinkEntityPopover>
        </div>
        <LinkedEntityList entityType={entityType} entityId={entityId} onNavigate={handleNavigate} />
        {linked.length > 1 && (
          <div className="border-t mt-2 pt-1">
            <OpenAllSubmenu linked={linked} onDone={() => setOpen(false)} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

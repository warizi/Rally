import { ExternalLink, X } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@shared/ui/tooltip'
import { useLinkedEntities, useUnlinkEntity } from '@entities/entity-link'
import type { LinkableEntityType } from '@shared/lib/entity-link'
import { ENTITY_TYPE_LABEL, ENTITY_TYPE_ICON } from '@shared/lib/entity-link'
import { PanePickerSubmenu } from './PanePickerSubmenu'

interface Props {
  entityType: LinkableEntityType
  entityId: string
  onNavigate?: (linkedType: LinkableEntityType, linkedId: string) => void
  onOpenInPane?: (linkedType: LinkableEntityType, linkedId: string, paneId: string) => void
}

export function LinkedEntityList({
  entityType,
  entityId,
  onNavigate,
  onOpenInPane
}: Props): React.JSX.Element {
  const { data: linked = [] } = useLinkedEntities(entityType, entityId)
  const unlinkEntity = useUnlinkEntity()

  if (linked.length === 0) {
    return <div className="text-xs text-muted-foreground py-2">연결된 항목이 없습니다</div>
  }

  return (
    <div className="space-y-1">
      {linked.map((item) => (
        <div
          key={`${item.entityType}-${item.entityId}`}
          className="flex items-center gap-2 group rounded px-2 py-1 hover:bg-accent text-xs"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground shrink-0">
                {(() => {
                  const Icon = ENTITY_TYPE_ICON[item.entityType]
                  return <Icon className="size-3.5" />
                })()}
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              {ENTITY_TYPE_LABEL[item.entityType]}
            </TooltipContent>
          </Tooltip>
          <button
            type="button"
            className="truncate text-left flex-1 hover:underline cursor-pointer"
            onClick={() => onNavigate?.(item.entityType, item.entityId)}
          >
            {item.title}
          </button>
          <PanePickerSubmenu
            onPaneSelect={(paneId) => onOpenInPane?.(item.entityType, item.entityId, paneId)}
            className="shrink-0"
          >
            {({ onClick }) => (
              <Button
                variant="ghost"
                size="icon"
                className="size-5 opacity-0 group-hover:opacity-100 shrink-0"
                onClick={onClick}
              >
                <ExternalLink className="size-3" />
              </Button>
            )}
          </PanePickerSubmenu>
          <Button
            variant="ghost"
            size="icon"
            className="size-5 opacity-0 group-hover:opacity-100 shrink-0"
            onClick={() =>
              unlinkEntity.mutate({
                typeA: entityType,
                idA: entityId,
                typeB: item.entityType,
                idB: item.entityId
              })
            }
          >
            <X className="size-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}

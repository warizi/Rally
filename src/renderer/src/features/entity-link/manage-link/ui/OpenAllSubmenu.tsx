import { ExternalLink } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import type { LinkedEntity } from '@shared/lib/entity-link'
import { toTabOptions } from '../lib/to-tab-options'
import { PanePickerSubmenu } from './PanePickerSubmenu'

interface Props {
  linked: LinkedEntity[]
  onDone: () => void
}

export function OpenAllSubmenu({ linked, onDone }: Props): React.JSX.Element {
  const openTab = useTabStore((s) => s.openTab)
  const closeTabByPathname = useTabStore((s) => s.closeTabByPathname)

  function handlePaneSelect(paneId: string): void {
    for (const item of linked) {
      const opts = toTabOptions(item.entityType, item.entityId, item.title)
      if (opts) {
        closeTabByPathname(opts.pathname)
        openTab(opts, paneId)
      }
    }
    onDone()
  }

  return (
    <PanePickerSubmenu onPaneSelect={handlePaneSelect}>
      {({ onClick, isOpen }) => (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'flex w-full items-center gap-2 text-xs rounded px-2 py-1.5 cursor-pointer text-muted-foreground',
            isOpen ? 'bg-accent' : 'hover:bg-accent'
          )}
        >
          <ExternalLink className="size-3.5 shrink-0" />
          <span>모두 열기</span>
        </button>
      )}
    </PanePickerSubmenu>
  )
}

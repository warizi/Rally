import { ScrollArea } from '@shared/ui/scroll-area'
import type { NodeContentProps } from '../../model/node-content-registry'

export function DefaultNodeContent({ refTitle, refPreview }: NodeContentProps): React.JSX.Element {
  return (
    <ScrollArea className="flex-1 min-h-0 nowheel">
      <div className="p-3">
        <p className="text-sm font-medium truncate">{refTitle || '(제목 없음)'}</p>
        {refPreview && (
          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{refPreview}</p>
        )}
      </div>
    </ScrollArea>
  )
}

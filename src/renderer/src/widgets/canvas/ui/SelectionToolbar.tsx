import { useCallback } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import { Copy, Trash2 } from 'lucide-react'
import { Button } from '@shared/ui/button'

interface SelectionToolbarProps {
  onCopy: () => void
}

export function SelectionToolbar({ onCopy }: SelectionToolbarProps): React.JSX.Element | null {
  const { deleteElements, getNodes, getEdges } = useReactFlow()

  const selectedNodeCount = useStore((s) => s.nodes.filter((n) => n.selected).length)
  const selectedEdgeCount = useStore((s) => s.edges.filter((e) => e.selected).length)
  const totalSelected = selectedNodeCount + selectedEdgeCount

  const handleDelete = useCallback(() => {
    const selectedNodes = getNodes().filter((n) => n.selected)
    const selectedEdges = getEdges().filter((e) => e.selected)
    deleteElements({ nodes: selectedNodes, edges: selectedEdges })
  }, [deleteElements, getNodes, getEdges])

  if (totalSelected === 0) return null

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10
                    flex items-center gap-2 bg-background/90 backdrop-blur border
                    rounded-lg shadow-sm px-3 py-1.5"
    >
      <span className="text-sm text-muted-foreground">{totalSelected}개 선택됨</span>
      {selectedNodeCount > 0 && (
        <Button variant="outline" size="sm" className="h-7 px-2" onClick={onCopy}>
          <Copy className="size-3.5 mr-1" />
          복사
        </Button>
      )}
      <Button variant="destructive" size="sm" className="h-7 px-2" onClick={handleDelete}>
        <Trash2 className="size-3.5 mr-1" />
        삭제
      </Button>
    </div>
  )
}

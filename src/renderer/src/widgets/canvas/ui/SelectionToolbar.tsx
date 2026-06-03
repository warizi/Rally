import { useCallback } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import { Copy, Trash2, Group } from 'lucide-react'
import { Button } from '@shared/ui/button'

interface SelectionToolbarProps {
  onCopy: () => void
  onGroupSelection: () => void
}

export function SelectionToolbar({
  onCopy,
  onGroupSelection
}: SelectionToolbarProps): React.JSX.Element | null {
  const { deleteElements, getNodes, getEdges } = useReactFlow()

  const selectedNodeCount = useStore((s) => s.nodes.filter((n) => n.selected).length)
  const selectedEdgeCount = useStore((s) => s.edges.filter((e) => e.selected).length)
  // 그룹으로 묶을 수 있는 일반 노드(그룹 제외) 선택 수
  const groupableCount = useStore(
    (s) => s.nodes.filter((n) => n.selected && n.type !== 'groupNode').length
  )
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
      {groupableCount >= 2 && (
        <Button variant="outline" size="sm" className="h-7 px-2" onClick={onGroupSelection}>
          <Group className="size-3.5 mr-1" />
          그룹으로 묶기
        </Button>
      )}
      <Button variant="destructive" size="sm" className="h-7 px-2" onClick={handleDelete}>
        <Trash2 className="size-3.5 mr-1" />
        삭제
      </Button>
    </div>
  )
}

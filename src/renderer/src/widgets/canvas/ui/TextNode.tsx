import { memo, useState, useCallback } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import { useUpdateCanvasNode, type TextNode as TextNodeType } from '@entities/canvas'
import { ScrollArea } from '@shared/ui/scroll-area'

function TextNodeComponent({ id, data, selected }: NodeProps<TextNodeType>): React.JSX.Element {
  const { mutate: updateNode } = useUpdateCanvasNode()
  const [editing, setEditing] = useState(false)
  const [localContent, setLocalContent] = useState(data.content ?? '')

  const handleBlur = useCallback(() => {
    setEditing(false)
    if (localContent !== (data.content ?? '')) {
      updateNode({
        nodeId: id,
        data: { content: localContent },
        canvasId: data.canvasId
      })
    }
  }, [id, localContent, data.content, data.canvasId, updateNode])

  return (
    <div
      className={`rounded-lg border bg-card text-card-foreground shadow-sm p-3 h-full ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
      style={{
        borderColor: data.color || undefined
      }}
    >
      <NodeResizer
        minWidth={160}
        minHeight={80}
        isVisible={selected}
        handleClassName="!size-2.5 !bg-primary !border-primary"
      />
      <Handle type="source" position={Position.Top} id="top" className="!w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2 !h-2" />
      <Handle type="source" position={Position.Left} id="left" className="!w-2 !h-2" />

      {editing ? (
        <ScrollArea className="w-full h-full nowheel">
          <textarea
            autoFocus
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            onBlur={handleBlur}
            className="nodrag w-full bg-transparent outline-none resize-none text-sm [field-sizing:content] min-h-full"
            placeholder="텍스트를 입력하세요..."
          />
        </ScrollArea>
      ) : (
        <ScrollArea
          className="w-full h-full nowheel"
          onDoubleClick={() => setEditing(true)}
        >
          <div className="text-sm whitespace-pre-wrap cursor-text">
            {localContent || <span className="text-muted-foreground">더블클릭하여 편집</span>}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

export const TextNode = memo(TextNodeComponent)

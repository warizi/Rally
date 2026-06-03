import { memo, useState, useCallback } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import { useUpdateCanvasGroup, type GroupNode as GroupNodeType } from '@entities/canvas'

/**
 * 캔버스 그룹 노드.
 * 요구사항(노트 "캔버스 그룹노드"):
 *  1. 점선 테두리        → border-dashed
 *  2. 투명도 있는 배경    → 반투명 fill
 *  3. 일반 노드·선보다 뒤 → zIndex 는 converter(GROUP_Z_INDEX)에서 음수로 고정
 *
 * 라벨은 더블클릭으로 인라인 편집한다. 엣지 연결 핸들은 없다(그룹은 연결 대상이 아님).
 */
function GroupNodeComponent({ id, data, selected }: NodeProps<GroupNodeType>): React.JSX.Element {
  const { mutate: updateGroup } = useUpdateCanvasGroup()
  const [editing, setEditing] = useState(false)
  const [localLabel, setLocalLabel] = useState(data.label ?? '')

  const commitLabel = useCallback(() => {
    setEditing(false)
    const next = localLabel.trim() === '' ? null : localLabel
    if (next !== (data.label ?? null)) {
      updateGroup({ groupId: id, data: { label: next }, canvasId: data.canvasId })
    }
  }, [id, localLabel, data.label, data.canvasId, updateGroup])

  const accent = data.color || undefined

  return (
    <div
      className={`h-full w-full rounded-lg border-2 border-dashed ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
      style={{
        borderColor: accent ?? 'var(--muted-foreground)',
        // 투명도 있는 배경 — 테두리와 같은 색을 옅게(약 10%). 색 없으면 muted 계열
        backgroundColor: accent ? `${accent}1a` : 'rgba(120, 120, 120, 0.05)'
      }}
    >
      <NodeResizer
        minWidth={120}
        minHeight={80}
        isVisible={selected}
        handleClassName="!size-2.5 !bg-primary !border-primary"
      />

      {/* 라벨 — 그룹 좌상단 */}
      <div className="absolute -top-6 left-0 max-w-full">
        {editing ? (
          <input
            autoFocus
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitLabel()
              if (e.key === 'Escape') {
                setLocalLabel(data.label ?? '')
                setEditing(false)
              }
            }}
            placeholder="그룹 이름"
            className="nodrag rounded bg-background/80 px-1 text-sm outline-none ring-1 ring-border"
          />
        ) : (
          <span
            className="cursor-text truncate text-sm font-medium text-muted-foreground"
            onDoubleClick={() => setEditing(true)}
            title="더블클릭하여 이름 편집"
          >
            {data.label || '그룹'}
          </span>
        )}
      </div>
    </div>
  )
}

export const GroupNode = memo(GroupNodeComponent)

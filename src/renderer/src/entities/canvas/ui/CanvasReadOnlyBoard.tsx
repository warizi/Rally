/**
 * 캔버스 read-only 미리보기 보드 — 노트 임베드(`![[canvas:id]]`) 전용.
 *
 * 설계 의도 (FSD 경계):
 * - 노트 임베드를 렌더하는 EmbedView 는 `features` 레이어 → `widgets/canvas` 의
 *   편집용 CanvasBoardInner / TextNode / RefNode 를 import 할 수 없다
 *   (features → entities/shared 만 허용).
 * - 그래서 entities/canvas 안에 **자체 완결형** read-only ReactFlow 보드를 둔다.
 *   converters(toReactFlowNode/Edge) 와 query 훅은 재사용하되, 노드 비주얼은
 *   편집 affordance(핸들/리사이저/더블클릭 편집)가 없는 경량 컴포넌트로 신규 작성.
 * - widgets 의 RefNode 는 노트 노드에서 풀 NoteEditor 를 mount → 캔버스 임베드가
 *   그걸 재사용하면 note→canvas→note 임베드 재귀 위험. 경량 노드는 NoteEditor 를
 *   띄우지 않아 재귀가 원천 차단된다.
 *
 * 상호작용: pan / zoom 가능, 편집 불가. 노드 클릭 무동작.
 */
import { useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  type NodeProps,
  type NodeTypes
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Type, Check, FileText, Calendar, Sheet, Image as ImageIcon, Network } from 'lucide-react'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import { useCanvasNodes, useCanvasEdges } from '../api/queries'
import { toReactFlowNode, toReactFlowEdge } from '../model/converters'
import type {
  TextNode as TextNodeType,
  RefNode as RefNodeType,
  CanvasNodeType
} from '../model/types'

const NODE_ICONS: Record<CanvasNodeType, React.ElementType> = {
  text: Type,
  todo: Check,
  note: FileText,
  schedule: Calendar,
  csv: Sheet,
  pdf: PdfIcon,
  image: ImageIcon,
  canvas: Network
}

/** 텍스트 노드 — 내용 텍스트만 표시 (편집 불가). */
function ReadOnlyTextNode({ data }: NodeProps<TextNodeType>): React.JSX.Element {
  return (
    <div
      className="rounded-lg border bg-card text-card-foreground shadow-sm p-3 h-full overflow-hidden"
      style={{ borderColor: data.color || undefined }}
    >
      <div className="text-sm whitespace-pre-wrap break-words">{data.content || ''}</div>
    </div>
  )
}

/** 참조 노드 — 타입 아이콘 + 제목 + (있으면) 미리보기 텍스트. 클릭 무동작. */
function ReadOnlyRefNode({ data }: NodeProps<RefNodeType>): React.JSX.Element {
  const Icon = NODE_ICONS[data.nodeType] ?? FileText
  const isBrokenRef = !!data.refId && !data.refTitle
  return (
    <div
      className={`rounded-lg border bg-card text-card-foreground shadow-sm h-full flex flex-col overflow-hidden ${
        isBrokenRef ? 'border-destructive opacity-60' : ''
      }`}
      style={{ borderColor: isBrokenRef ? undefined : data.color || undefined }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2 border-b bg-muted/30">
        <div className="size-6 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Icon className="size-3.5 text-muted-foreground" />
        </div>
        <span className="text-sm font-medium text-foreground flex-1 truncate">
          {data.refTitle || data.nodeType}
        </span>
      </div>
      {data.refPreview ? (
        <div className="flex-1 min-h-0 p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words overflow-hidden">
          {data.refPreview}
        </div>
      ) : null}
    </div>
  )
}

const NODE_TYPES: NodeTypes = {
  textNode: ReadOnlyTextNode,
  refNode: ReadOnlyRefNode
}

interface Props {
  canvasId: string
}

export function CanvasReadOnlyBoard({ canvasId }: Props): React.JSX.Element {
  const { data: nodeItems = [] } = useCanvasNodes(canvasId)
  const { data: edgeItems = [] } = useCanvasEdges(canvasId)

  const nodes = useMemo(() => nodeItems.map(toReactFlowNode), [nodeItems])
  // 편집용 CustomEdge(widgets) 대신 기본 엣지로 렌더 — label/marker/style 은 standard
  // Edge prop 이라 그대로 표시된다. type 만 기본값(undefined)으로 덮어쓴다.
  const edges = useMemo(
    () => edgeItems.map((e) => ({ ...toReactFlowEdge(e), type: undefined })),
    [edgeItems]
  )

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        minZoom={0.1}
        maxZoom={4}
        // 편집 차단 — pan/zoom 만 허용
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </ReactFlowProvider>
  )
}

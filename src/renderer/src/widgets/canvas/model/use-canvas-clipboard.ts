import type {
  CanvasNodeType,
  CanvasEdgeSide,
  CanvasEdgeStyle,
  CanvasEdgeArrow,
  CanvasNode,
  CanvasEdge,
  CanvasNodeItem,
  CanvasEdgeItem,
  CreateCanvasNodeData,
  CreateCanvasEdgeData,
  RefNodeData
} from '@entities/canvas'

interface ClipboardNode {
  type: CanvasNodeType
  refId: string | null
  content: string | null
  color: string | null
  width: number
  height: number
  dx: number
  dy: number
  originalId: string
}

interface ClipboardEdge {
  fromOriginalId: string
  toOriginalId: string
  fromSide: CanvasEdgeSide
  toSide: CanvasEdgeSide
  label: string | null
  color: string | null
  style: CanvasEdgeStyle
  arrow: CanvasEdgeArrow
}

// Module-scope clipboard storage (app-internal, not system clipboard)
let clipboard: { nodes: ClipboardNode[]; edges: ClipboardEdge[] } | null = null
let pasteCount = 0

export function useCanvasClipboard(): {
  copy: (nodes: CanvasNode[], edges: CanvasEdge[]) => boolean
  paste: (
    canvasId: string,
    viewportCenter: { x: number; y: number },
    createNodeAsync: (args: {
      canvasId: string
      data: CreateCanvasNodeData
    }) => Promise<CanvasNodeItem>,
    createEdgeAsync: (args: {
      canvasId: string
      data: CreateCanvasEdgeData
    }) => Promise<CanvasEdgeItem>
  ) => Promise<string[]>
  hasClipboard: () => boolean
} {
  function copy(nodes: CanvasNode[], edges: CanvasEdge[]): boolean {
    const selectedNodes = nodes.filter((n) => n.selected)
    if (selectedNodes.length === 0) return false

    const selectedIds = new Set(selectedNodes.map((n) => n.id))
    const baseX = selectedNodes[0].position.x
    const baseY = selectedNodes[0].position.y

    const clipNodes: ClipboardNode[] = selectedNodes.map((n) => ({
      type: n.data.nodeType as CanvasNodeType,
      refId: n.type === 'refNode' ? (n.data as RefNodeData).refId : null,
      content: n.data.content,
      color: n.data.color,
      width: n.data.width,
      height: n.data.height,
      dx: n.position.x - baseX,
      dy: n.position.y - baseY,
      originalId: n.id
    }))

    const clipEdges: ClipboardEdge[] = edges
      .filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target))
      .map((e) => ({
        fromOriginalId: e.source,
        toOriginalId: e.target,
        fromSide: e.data?.fromSide ?? 'right',
        toSide: e.data?.toSide ?? 'left',
        label: typeof e.label === 'string' ? e.label : null,
        color: e.data?.color ?? null,
        style: e.data?.edgeStyle ?? 'solid',
        arrow: e.data?.arrow ?? 'end'
      }))

    clipboard = { nodes: clipNodes, edges: clipEdges }
    pasteCount = 0
    return true
  }

  async function paste(
    canvasId: string,
    viewportCenter: { x: number; y: number },
    createNodeAsync: (args: {
      canvasId: string
      data: CreateCanvasNodeData
    }) => Promise<CanvasNodeItem>,
    createEdgeAsync: (args: {
      canvasId: string
      data: CreateCanvasEdgeData
    }) => Promise<CanvasEdgeItem>
  ): Promise<string[]> {
    if (!clipboard || clipboard.nodes.length === 0) return []

    pasteCount++
    const offset = pasteCount * 30
    const idMap = new Map<string, string>()

    for (const node of clipboard.nodes) {
      const x = viewportCenter.x + node.dx + offset
      const y = viewportCenter.y + node.dy + offset

      const data: CreateCanvasNodeData = {
        type: node.type,
        x,
        y,
        width: node.width,
        height: node.height
      }
      if (node.content != null) data.content = node.content
      if (node.color != null) data.color = node.color
      if (node.refId != null) data.refId = node.refId

      const created = await createNodeAsync({ canvasId, data })
      idMap.set(node.originalId, created.id)
    }

    for (const edge of clipboard.edges) {
      const fromNode = idMap.get(edge.fromOriginalId)
      const toNode = idMap.get(edge.toOriginalId)
      if (!fromNode || !toNode) continue

      const data: CreateCanvasEdgeData = {
        fromNode,
        toNode,
        fromSide: edge.fromSide,
        toSide: edge.toSide,
        style: edge.style,
        arrow: edge.arrow
      }
      if (edge.label != null) data.label = edge.label
      if (edge.color != null) data.color = edge.color

      await createEdgeAsync({ canvasId, data })
    }

    return [...idMap.values()]
  }

  function hasClipboard(): boolean {
    return clipboard !== null && clipboard.nodes.length > 0
  }

  return { copy, paste, hasClipboard }
}

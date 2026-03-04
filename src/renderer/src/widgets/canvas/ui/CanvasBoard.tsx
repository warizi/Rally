import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasData } from '../model/use-canvas-data'
import { CanvasBoardInner } from './CanvasBoardInner'

interface CanvasBoardProps {
  canvasId: string
  tabId?: string
}

export function CanvasBoard({ canvasId, tabId }: CanvasBoardProps): React.JSX.Element {
  const canvasData = useCanvasData(canvasId, tabId)

  const isReady = !canvasData.isLoading && canvasData.hydrated

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <div className="animate-spin size-6 border-2 border-muted-foreground border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm">캔버스 로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <CanvasBoardInner
        nodes={canvasData.nodes}
        edges={canvasData.edges}
        defaultViewport={canvasData.defaultViewport}
        hasSavedViewport={canvasData.hasSavedViewport}
        onNodesChange={canvasData.onNodesChange}
        onEdgesChange={canvasData.onEdgesChange}
        onConnect={canvasData.onConnect}
        saveViewport={canvasData.saveViewport}
        addTextNode={canvasData.addTextNode}
        addRefNode={canvasData.addRefNode}
        canvasId={canvasId}
        createNodeAsync={canvasData.createNodeAsync}
        createEdgeAsync={canvasData.createEdgeAsync}
        undo={canvasData.undo}
        redo={canvasData.redo}
        canUndo={canvasData.canUndo}
        canRedo={canvasData.canRedo}
      />
    </ReactFlowProvider>
  )
}

import { useState } from 'react'
import { Plus, Network, Trash2 } from 'lucide-react'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { Button } from '@shared/ui/button'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { ROUTES } from '@shared/constants/tab-url'
import { useTabStore, selectPaneByTabId } from '@features/tap-system/manage-tab-system'
import { CreateCanvasDialog } from '@features/canvas/create-canvas/ui/CreateCanvasDialog'
import { DeleteCanvasDialog } from '@features/canvas/delete-canvas/ui/DeleteCanvasDialog'
import { useCanvasesByWorkspace, useCreateCanvas, type CanvasItem } from '@entities/canvas'

interface Props {
  tabId?: string
}

export function CanvasListPage({ tabId }: Props): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const { data: canvases = [], isLoading } = useCanvasesByWorkspace(workspaceId)
  const { mutate: createCanvas, isPending } = useCreateCanvas()

  const openTab = useTabStore((s) => s.openTab)
  const pane = useTabStore(selectPaneByTabId(tabId ?? ''))

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CanvasItem | null>(null)

  const handleCreate = (data: { title: string; description?: string }): void => {
    if (!workspaceId) return
    createCanvas(
      { workspaceId, data },
      {
        onSuccess: (canvas) => {
          setDialogOpen(false)
          openTab(
            {
              type: 'canvas-detail',
              pathname: ROUTES.CANVAS_DETAIL.replace(':canvasId', canvas.id),
              title: canvas.title
            },
            pane?.id
          )
        }
      }
    )
  }

  const handleOpen = (canvas: CanvasItem): void => {
    openTab(
      {
        type: 'canvas-detail',
        pathname: ROUTES.CANVAS_DETAIL.replace(':canvasId', canvas.id),
        title: canvas.title
      },
      pane?.id
    )
  }

  const handleRemove = (canvas: CanvasItem): void => {
    setDeleteTarget(canvas)
  }

  return (
    <TabContainer
      header={
        <TabHeader
          title="캔버스"
          description="아이디어를 시각적으로 연결하고 정리하세요"
          icon={Network}
          isLoading={isLoading}
          buttons={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4 mr-1" />새 캔버스
            </Button>
          }
        />
      }
    >
      <div className="py-4 space-y-3">
        {canvases.length === 0 && !isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <Network className="size-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">캔버스가 없습니다</p>
            <p className="text-xs mt-1">새 캔버스를 만들어 아이디어를 연결해보세요</p>
          </div>
        )}

        <div className="grid grid-cols-1 @[400px]:grid-cols-2 @[800px]:grid-cols-3 gap-3">
          {canvases.map((canvas) => (
            <div
              key={canvas.id}
              role="button"
              tabIndex={0}
              onClick={() => handleOpen(canvas)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleOpen(canvas)
              }}
              className="group text-left p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Network className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-sm truncate">{canvas.title}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(canvas)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </button>
              </div>
              {canvas.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {canvas.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground/60 mt-2">
                {new Date(canvas.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      <CreateCanvasDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isPending={isPending}
        onSubmit={handleCreate}
      />

      {deleteTarget && workspaceId && (
        <DeleteCanvasDialog
          canvasId={deleteTarget.id}
          canvasTitle={deleteTarget.title}
          workspaceId={workspaceId}
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          onDeleted={() => setDeleteTarget(null)}
        />
      )}
    </TabContainer>
  )
}

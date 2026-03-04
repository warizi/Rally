import { Network } from 'lucide-react'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { LinkedEntityPopoverButton } from '@features/entity-link/manage-link'
import { TagList } from '@features/tag/manage-tag'
import { useCanvasById, useUpdateCanvas } from '@entities/canvas'
import { CanvasBoard } from '@widgets/canvas/ui/CanvasBoard'

interface Props {
  tabId?: string
  params?: { canvasId?: string }
}

export function CanvasDetailPage({ tabId, params }: Props): React.JSX.Element {
  const canvasId = params?.canvasId
  const { data: canvas, isLoading } = useCanvasById(canvasId)
  const { mutate: updateCanvas } = useUpdateCanvas()
  const setTabTitle = useTabStore((s) => s.setTabTitle)

  const handleTitleChange = (title: string): void => {
    if (!canvas) return
    updateCanvas(
      { canvasId: canvas.id, data: { title }, workspaceId: canvas.workspaceId },
      {
        onSuccess: () => {
          if (tabId) setTabTitle(tabId, title)
        }
      }
    )
  }

  const handleDescriptionChange = (description: string): void => {
    if (!canvas) return
    updateCanvas({
      canvasId: canvas.id,
      data: { description },
      workspaceId: canvas.workspaceId
    })
  }

  if (!canvasId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        캔버스를 찾을 수 없습니다
      </div>
    )
  }

  return (
    <TabContainer
      header={
        <TabHeader
          title={canvas?.title}
          description={canvas?.description ?? undefined}
          icon={Network}
          isLoading={isLoading}
          editable
          onTitleChange={handleTitleChange}
          onDescriptionChange={handleDescriptionChange}
          buttons={
            canvas ? (
              <LinkedEntityPopoverButton
                entityType="canvas"
                entityId={canvas.id}
                workspaceId={canvas.workspaceId}
              />
            ) : undefined
          }
          footer={
            canvas ? (
              <TagList
                workspaceId={canvas.workspaceId}
                itemType="canvas"
                itemId={canvas.id}
              />
            ) : undefined
          }
        />
      }
      scrollable={false}
      maxWidth="full"
    >
      <CanvasBoard canvasId={canvasId} tabId={tabId} />
    </TabContainer>
  )
}

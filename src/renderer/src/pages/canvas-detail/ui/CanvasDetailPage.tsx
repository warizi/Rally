import { useEffect } from 'react'
import { Network, FolderX } from 'lucide-react'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { useTabStore } from '@/entities/tab-system'
import { LinkedEntityPopoverButton } from '@/widgets/entity-link'
import { TagList } from '@/widgets/tag'
import { AuthorBadgePair } from '@shared/ui/author-badge'
import { useCanvasById, useUpdateCanvas } from '@entities/canvas'
import { CanvasBoard } from '@widgets/canvas/ui/CanvasBoard'

interface Props {
  tabId?: string
  params?: { canvasId?: string }
}

export function CanvasDetailPage({ tabId, params }: Props): React.JSX.Element {
  const canvasId = params?.canvasId
  const { data: canvas, isLoading, isError } = useCanvasById(canvasId)
  const { mutate: updateCanvas } = useUpdateCanvas()
  const setTabTitle = useTabStore((s) => s.setTabTitle)
  const setTabError = useTabStore((s) => s.setTabError)

  // 캔버스가 외부(MCP 등)에서 삭제되면 query 가 NotFound → 빈 보드를 띄우지 않고
  // 다른 도메인(note/csv)처럼 "찾을 수 없는 페이지" 로 전환한다.
  // (CanvasBoard 를 마운트하지 않으면 보드의 sync mutation 이 삭제된 캔버스에 쓰며
  //  "Canvas not found" 에러 토스트를 띄우는 연쇄도 차단된다.)
  useEffect(() => {
    if (tabId && isError) {
      setTabError(tabId, true)
    }
  }, [isError, tabId, setTabError])

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

  if (isError) {
    return (
      <TabContainer header={null}>
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground mt-20">
          <FolderX className="size-12" />
          <p className="text-sm">캔버스 불러오기를 실패하였습니다.</p>
          <p className="text-xs">이 탭을 닫아주세요.</p>
        </div>
      </TabContainer>
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
              <div className="flex items-center justify-between gap-3">
                <TagList workspaceId={canvas.workspaceId} itemType="canvas" itemId={canvas.id} />
                <AuthorBadgePair
                  createdBy={canvas.createdBy}
                  createdById={canvas.createdById}
                  createdAt={canvas.createdAt}
                  updatedBy={canvas.updatedBy}
                  updatedById={canvas.updatedById}
                  updatedAt={canvas.updatedAt}
                  size="sm"
                />
              </div>
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

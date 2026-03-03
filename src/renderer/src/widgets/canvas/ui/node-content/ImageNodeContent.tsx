import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useReadImageContent, useImageFilesByWorkspace } from '@entities/image-file'
import { ImageViewer } from '@features/image/view-image'
import type { NodeContentProps } from '../../model/node-content-registry'

export function ImageNodeContent({ refId, refTitle }: NodeContentProps): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const { data, isLoading } = useReadImageContent(workspaceId, refId ?? '')
  const { data: imageFiles } = useImageFilesByWorkspace(workspaceId)
  const image = imageFiles?.find((i) => i.id === refId)

  if (isLoading) {
    return <div className="p-3 flex-1 text-xs text-muted-foreground">불러오는 중...</div>
  }

  if (!data?.data) {
    return (
      <div className="p-3 flex-1 text-xs text-muted-foreground">이미지를 불러올 수 없습니다.</div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden min-h-0">
      <ImageViewer
        imageId={refId ?? ''}
        imageData={data.data}
        title={image?.title ?? refTitle ?? ''}
      />
    </div>
  )
}

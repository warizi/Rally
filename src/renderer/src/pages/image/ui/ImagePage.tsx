import { JSX, useEffect } from 'react'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useReadImageContent } from '@entities/image-file'
import { useImageFilesByWorkspace } from '@entities/image-file'
import { useTabStore } from '@/features/tap-system/manage-tab-system'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { FolderX } from 'lucide-react'
import { ImageHeader } from '@/features/image/view-image'
import { ImageViewer } from '@widgets/image-viewer'

export function ImagePage({
  tabId,
  params
}: {
  tabId?: string
  params?: Record<string, string>
}): JSX.Element {
  const imageId = params?.imageId ?? ''
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const setTabError = useTabStore((s) => s.setTabError)

  const { data, isLoading, isError } = useReadImageContent(workspaceId, imageId)
  const { data: imageFiles } = useImageFilesByWorkspace(workspaceId)
  const image = imageFiles?.find((i) => i.id === imageId)

  // 에러 시 탭에 에러 상태 표시
  useEffect(() => {
    if (tabId && isError) {
      setTabError(tabId, true)
    }
  }, [isError, tabId, setTabError])

  // 빈 ID 체크
  if (!imageId || !workspaceId) {
    return (
      <TabContainer header={null}>
        <div className="text-sm text-muted-foreground p-4">이미지 정보가 없습니다.</div>
      </TabContainer>
    )
  }

  // 로딩 스켈레톤
  if (isLoading) {
    return (
      <TabContainer header={<TabHeader isLoading />}>
        <div />
      </TabContainer>
    )
  }

  // 에러 상태
  if (isError) {
    return (
      <TabContainer header={null}>
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground mt-20">
          <FolderX className="size-12" />
          <p className="text-sm">이미지를 불러오기를 실패하였습니다.</p>
          <p className="text-xs">이 탭을 닫아주세요.</p>
        </div>
      </TabContainer>
    )
  }

  return (
    <TabContainer
      scrollable={false}
      maxWidth="full"
      header={<ImageHeader workspaceId={workspaceId} imageId={imageId} tabId={tabId} />}
    >
      <ImageViewer
        imageId={imageId}
        imageData={data?.data ?? new ArrayBuffer(0)}
        title={image?.title ?? ''}
      />
    </TabContainer>
  )
}

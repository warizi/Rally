import { JSX } from 'react'
import TabHeader from '@shared/ui/tab-header'
import {
  useRenameImageFile,
  useUpdateImageMeta,
  useImageFilesByWorkspace
} from '@entities/image-file'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { ImageIcon } from 'lucide-react'
import { LinkedEntityPopoverButton } from '@features/entity-link/manage-link'
import { TagList } from '@features/tag/manage-tag'

interface ImageHeaderProps {
  workspaceId: string
  imageId: string
  tabId?: string
}

export function ImageHeader({ workspaceId, imageId, tabId }: ImageHeaderProps): JSX.Element {
  const { data: imageFiles } = useImageFilesByWorkspace(workspaceId)
  const image = imageFiles?.find((i) => i.id === imageId)
  const { mutate: renameImage } = useRenameImageFile()
  const { mutate: updateMeta } = useUpdateImageMeta()
  const setTabTitle = useTabStore((s) => s.setTabTitle)

  return (
    <TabHeader
      editable
      icon={ImageIcon}
      iconColor="#0ea5e9"
      title={image?.title ?? ''}
      description={image?.description ?? ''}
      buttons={
        <LinkedEntityPopoverButton
          entityType="image"
          entityId={imageId}
          workspaceId={workspaceId}
        />
      }
      footer={<TagList workspaceId={workspaceId} itemType="image" itemId={imageId} />}
      onTitleChange={(title) => {
        renameImage({ workspaceId, imageId, newName: title })
        if (tabId) setTabTitle(tabId, title)
      }}
      onDescriptionChange={(desc) => {
        updateMeta({ workspaceId, imageId, data: { description: desc } })
      }}
    />
  )
}

import { ImageIcon } from 'lucide-react'
import { ROUTES } from '@shared/constants/tab-url'
import { isOwnWrite, IMAGE_EXTERNAL_CHANGED_EVENT } from '@entities/image-file'
import { useFileWatcher } from '../lib/use-file-watcher'

/** MainLayout에서 호출 — image:changed push 이벤트 구독 + React Query invalidation */
export function useImageWatcher(): void {
  useFileWatcher({
    onChanged: window.api.image.onChanged,
    queryKeyPrefix: 'image',
    icon: ImageIcon,
    externalChangedEvent: IMAGE_EXTERNAL_CHANGED_EVENT,
    idField: 'imageId',
    isOwnWrite,
    buildTabOptions: (item) => ({
      type: 'image',
      pathname: ROUTES.IMAGE_DETAIL.replace(':imageId', item.id),
      title: item.title
    })
  })
}

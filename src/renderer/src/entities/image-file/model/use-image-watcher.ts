import { ImageIcon } from 'lucide-react'
import { useFileWatcher } from '@shared/hooks/use-file-watcher'
import { isOwnWrite } from './own-write-tracker'

/** 외부 파일 변경 시 발생하는 커스텀 이벤트 이름 */
export const IMAGE_EXTERNAL_CHANGED_EVENT = 'image:external-changed'

/** MainLayout에서 호출 — image:changed push 이벤트 구독 + React Query invalidation */
export function useImageWatcher(): void {
  useFileWatcher({
    onChanged: window.api.image.onChanged,
    queryKeyPrefix: 'image',
    icon: ImageIcon,
    externalChangedEvent: IMAGE_EXTERNAL_CHANGED_EVENT,
    idField: 'imageId',
    isOwnWrite
  })
}

import { createElement, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { ImageFileNode } from './types'
import { isWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { isOwnWrite } from './own-write-tracker'

/** 외부 파일 변경 시 발생하는 커스텀 이벤트 이름 */
export const IMAGE_EXTERNAL_CHANGED_EVENT = 'image:external-changed'

/** MainLayout에서 호출 — image:changed push 이벤트 구독 + React Query invalidation */
export function useImageWatcher(): void {
  const queryClient = useQueryClient()
  const readyRef = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true
    }, 2000)
    const unsub = window.api.image.onChanged((workspaceId: string, changedRelPaths: string[]) => {
      // Image 목록 무효화
      queryClient.invalidateQueries({ queryKey: ['image', 'workspace', workspaceId] })

      // 변경된 파일 중 외부 변경만 처리
      const images = queryClient.getQueryData<ImageFileNode[]>(['image', 'workspace', workspaceId])
      if (images && changedRelPaths.length > 0) {
        const externalImages = images.filter(
          (i) =>
            changedRelPaths.includes(i.relativePath) &&
            !isOwnWrite(i.id) &&
            !isWorkspaceOwnWrite(workspaceId)
        )
        if (readyRef.current && externalImages.length > 0) {
          toast.info('외부에서 파일이 변경되었습니다', {
            description: createElement(
              'ul',
              { className: 'mt-1 flex flex-col gap-0.5' },
              ...externalImages.map((i) =>
                createElement(
                  'li',
                  { key: i.id, className: 'flex items-center gap-1.5' },
                  createElement(ImageIcon, { className: 'size-3.5 shrink-0' }),
                  i.title
                )
              )
            )
          })
        }
        externalImages.forEach((i) => {
          queryClient.refetchQueries({ queryKey: ['image', 'content', i.id] }).then(() => {
            window.dispatchEvent(
              new CustomEvent(IMAGE_EXTERNAL_CHANGED_EVENT, { detail: { imageId: i.id } })
            )
          })
        })
      }
    })
    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, [queryClient])
}

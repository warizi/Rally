import { createElement, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'

interface FileWatcherConfig {
  /** window.api[type].onChanged 메서드 */
  onChanged: (cb: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
  /** React Query 캐시 키 prefix (예: 'note') */
  queryKeyPrefix: string
  /** 토스트 아이콘 컴포넌트 */
  icon: React.ComponentType<{ className?: string }>
  /** 커스텀 이벤트 이름 */
  externalChangedEvent: string
  /** entity ID 필드명 (CustomEvent detail) */
  idField: string
  /** isOwnWrite 함수 */
  isOwnWrite: (id: string) => boolean
}

export function useFileWatcher(config: FileWatcherConfig): void {
  const queryClient = useQueryClient()
  const readyRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true
    }, 2000)

    const unsub = config.onChanged((workspaceId, changedRelPaths) => {
      queryClient.invalidateQueries({
        queryKey: [config.queryKeyPrefix, 'workspace', workspaceId]
      })

      const items = queryClient.getQueryData<
        Array<{ id: string; relativePath: string; title: string }>
      >([config.queryKeyPrefix, 'workspace', workspaceId])

      if (items && changedRelPaths.length > 0) {
        const externalItems = items.filter(
          (item) =>
            changedRelPaths.includes(item.relativePath) &&
            !config.isOwnWrite(item.id) &&
            !isWorkspaceOwnWrite(workspaceId)
        )

        if (readyRef.current && externalItems.length > 0) {
          toast.info('외부에서 파일이 변경되었습니다', {
            description: createElement(
              'ul',
              { className: 'mt-1 flex flex-col gap-0.5' },
              ...externalItems.map((item) =>
                createElement(
                  'li',
                  { key: item.id, className: 'flex items-center gap-1.5' },
                  createElement(config.icon, { className: 'size-3.5 shrink-0' }),
                  item.title
                )
              )
            )
          })
        }

        externalItems.forEach((item) => {
          queryClient
            .refetchQueries({
              queryKey: [config.queryKeyPrefix, 'content', item.id]
            })
            .then(() => {
              window.dispatchEvent(
                new CustomEvent(config.externalChangedEvent, {
                  detail: { [config.idField]: item.id }
                })
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

import { createElement, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { useTabStore } from '@features/tab-system/manage-tab-system'
import type { TabOptions } from '@features/tab-system/manage-tab-system/model/types'
import { AuthorBadge } from '@shared/ui/author-badge'
import { formatAuthor } from '@shared/lib/format-author'

interface WatchedItem {
  id: string
  relativePath: string
  title: string
  updatedBy?: 'user' | 'ai'
  updatedById?: string | null
  updatedAt?: Date | string | number
}

interface WatcherActor {
  kind: 'user' | 'ai'
  id: string | null
}

interface FileWatcherConfig {
  /** window.api[type].onChanged 메서드 */
  onChanged: (
    cb: (workspaceId: string, changedRelPaths: string[], actor: WatcherActor | null) => void
  ) => () => void
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
  /** 클릭 시 열 탭 옵션 빌더 */
  buildTabOptions: (item: WatchedItem) => TabOptions
}

export function useFileWatcher(config: FileWatcherConfig): void {
  const queryClient = useQueryClient()
  const openTab = useTabStore((s) => s.openTab)
  const readyRef = useRef(false)
  const {
    onChanged,
    queryKeyPrefix,
    icon,
    externalChangedEvent,
    idField,
    isOwnWrite: checkOwnWrite,
    buildTabOptions
  } = config

  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true
    }, 2000)

    const unsub = onChanged((workspaceId, changedRelPaths, actor) => {
      queryClient.invalidateQueries({
        queryKey: [queryKeyPrefix, 'workspace', workspaceId]
      })

      const items = queryClient.getQueryData<WatchedItem[]>([
        queryKeyPrefix,
        'workspace',
        workspaceId
      ])

      if (items && changedRelPaths.length > 0) {
        const externalItems = items.filter(
          (item) =>
            changedRelPaths.includes(item.relativePath) &&
            !checkOwnWrite(item.id) &&
            !isWorkspaceOwnWrite(workspaceId)
        )

        if (readyRef.current && externalItems.length > 0) {
          const isAi = actor?.kind === 'ai'
          const title = isAi
            ? `${formatAuthor('ai', actor?.id ?? null)} 가 변경하였습니다`
            : '외부에서 파일이 변경되었습니다'

          toast.info(title, {
            description: createElement(
              'ul',
              { className: 'mt-1 flex flex-col gap-0.5' },
              ...externalItems.map((item) =>
                createElement(
                  'li',
                  { key: item.id },
                  createElement(
                    'button',
                    {
                      type: 'button',
                      className:
                        'flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-accent cursor-pointer',
                      onClick: () => {
                        openTab(buildTabOptions(item))
                        toast.dismiss()
                      }
                    },
                    createElement(icon, { className: 'size-3.5 shrink-0' }),
                    createElement('span', { className: 'truncate flex-1' }, item.title),
                    item.updatedBy &&
                      createElement(AuthorBadge, {
                        by: item.updatedBy,
                        byId: item.updatedById ?? null,
                        at: item.updatedAt,
                        size: 'sm'
                      })
                  )
                )
              )
            )
          })
        }

        externalItems.forEach((item) => {
          queryClient
            .refetchQueries({
              queryKey: [queryKeyPrefix, 'content', item.id]
            })
            .then(() => {
              window.dispatchEvent(
                new CustomEvent(externalChangedEvent, {
                  detail: { [idField]: item.id }
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
  }, [
    queryClient,
    onChanged,
    queryKeyPrefix,
    icon,
    externalChangedEvent,
    idField,
    checkOwnWrite,
    buildTabOptions,
    openTab
  ])
}

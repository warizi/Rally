import { createElement, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Folder } from 'lucide-react'
import { toast } from 'sonner'
import { isWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { useTabStore } from '@/entities/tab-system'
import { ROUTES } from '@shared/constants/tab-url'
import { formatAuthor } from '@shared/lib/format-author'

/** MainLayout에서 호출 — push 이벤트 구독 + React Query invalidation */
export function useFolderWatcher(): void {
  const queryClient = useQueryClient()
  const openTab = useTabStore((s) => s.openTab)
  const readyRef = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true
    }, 2000)
    const unsub = window.api.folder.onChanged((workspaceId, changedRelPaths, actor) => {
      queryClient.invalidateQueries({ queryKey: ['folder', 'tree', workspaceId] })
      if (readyRef.current && changedRelPaths.length > 0 && !isWorkspaceOwnWrite(workspaceId)) {
        const names = [...new Set(changedRelPaths.map((p) => p.split('/').pop() ?? p))]
        const isAi = actor?.kind === 'ai'
        const title = isAi
          ? `${formatAuthor('ai', actor?.id ?? null)} 가 폴더를 변경하였습니다`
          : '외부에서 폴더가 변경되었습니다'

        toast.info(title, {
          description: createElement(
            'ul',
            { className: 'mt-1 flex flex-col gap-0.5' },
            ...names.map((name) =>
              createElement(
                'li',
                { key: name },
                createElement(
                  'button',
                  {
                    type: 'button',
                    className:
                      'flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-accent cursor-pointer',
                    onClick: () => {
                      openTab({
                        type: 'folder',
                        pathname: ROUTES.FOLDER,
                        title: '파일 탐색기'
                      })
                      toast.dismiss()
                    }
                  },
                  createElement(Folder, { className: 'size-3.5 shrink-0' }),
                  createElement('span', { className: 'truncate flex-1' }, name)
                )
              )
            )
          )
        })
      }
    })
    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, [queryClient, openTab])
}

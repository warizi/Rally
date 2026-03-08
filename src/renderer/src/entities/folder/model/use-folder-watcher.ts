import { createElement, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Folder } from 'lucide-react'
import { toast } from 'sonner'
import { isWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'

/** MainLayout에서 호출 — push 이벤트 구독 + React Query invalidation */
export function useFolderWatcher(): void {
  const queryClient = useQueryClient()
  const readyRef = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true
    }, 2000)
    const unsub = window.api.folder.onChanged((workspaceId: string, changedRelPaths: string[]) => {
      queryClient.invalidateQueries({ queryKey: ['folder', 'tree', workspaceId] })
      if (readyRef.current && changedRelPaths.length > 0 && !isWorkspaceOwnWrite(workspaceId)) {
        const names = [...new Set(changedRelPaths.map((p) => p.split('/').pop() ?? p))]
        toast.info('외부에서 폴더가 변경되었습니다', {
          description: createElement(
            'ul',
            { className: 'mt-1 flex flex-col gap-0.5' },
            ...names.map((name) =>
              createElement(
                'li',
                { key: name, className: 'flex items-center gap-1.5' },
                createElement(Folder, { className: 'size-3.5 shrink-0' }),
                name
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
  }, [queryClient])
}

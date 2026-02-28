import { createElement, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sheet } from 'lucide-react'
import { toast } from 'sonner'
import type { CsvFileNode } from './types'
import { isWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { isOwnWrite } from './own-write-tracker'

/** 외부 파일 변경 시 발생하는 커스텀 이벤트 이름 */
export const CSV_EXTERNAL_CHANGED_EVENT = 'csv:external-changed'

/** MainLayout에서 호출 — csv:changed push 이벤트 구독 + React Query invalidation */
export function useCsvWatcher(): void {
  const queryClient = useQueryClient()
  const readyRef = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true
    }, 2000)
    const unsub = window.api.csv.onChanged((workspaceId: string, changedRelPaths: string[]) => {
      // CSV 목록 무효화
      queryClient.invalidateQueries({ queryKey: ['csv', 'workspace', workspaceId] })

      // 변경된 파일 중 외부 변경만 처리
      const csvs = queryClient.getQueryData<CsvFileNode[]>(['csv', 'workspace', workspaceId])
      if (csvs && changedRelPaths.length > 0) {
        const externalCsvs = csvs.filter(
          (c) =>
            changedRelPaths.includes(c.relativePath) &&
            !isOwnWrite(c.id) &&
            !isWorkspaceOwnWrite(workspaceId)
        )
        if (readyRef.current && externalCsvs.length > 0) {
          toast.info('외부에서 파일이 변경되었습니다', {
            description: createElement(
              'ul',
              { className: 'mt-1 flex flex-col gap-0.5' },
              ...externalCsvs.map((c) =>
                createElement(
                  'li',
                  { key: c.id, className: 'flex items-center gap-1.5' },
                  createElement(Sheet, { className: 'size-3.5 shrink-0' }),
                  c.title
                )
              )
            )
          })
        }
        externalCsvs.forEach((c) => {
          queryClient.refetchQueries({ queryKey: ['csv', 'content', c.id] }).then(() => {
            window.dispatchEvent(
              new CustomEvent(CSV_EXTERNAL_CHANGED_EVENT, { detail: { csvId: c.id } })
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

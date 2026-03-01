import { createElement, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'
import type { PdfFileNode } from './types'
import { isWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { isOwnWrite } from './own-write-tracker'

/** 외부 파일 변경 시 발생하는 커스텀 이벤트 이름 */
export const PDF_EXTERNAL_CHANGED_EVENT = 'pdf:external-changed'

/** MainLayout에서 호출 — pdf:changed push 이벤트 구독 + React Query invalidation */
export function usePdfWatcher(): void {
  const queryClient = useQueryClient()
  const readyRef = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true
    }, 2000)
    const unsub = window.api.pdf.onChanged((workspaceId: string, changedRelPaths: string[]) => {
      queryClient.invalidateQueries({ queryKey: ['pdf', 'workspace', workspaceId] })

      const pdfs = queryClient.getQueryData<PdfFileNode[]>(['pdf', 'workspace', workspaceId])
      if (pdfs && changedRelPaths.length > 0) {
        const externalPdfs = pdfs.filter(
          (p) =>
            changedRelPaths.includes(p.relativePath) &&
            !isOwnWrite(p.id) &&
            !isWorkspaceOwnWrite(workspaceId)
        )
        if (readyRef.current && externalPdfs.length > 0) {
          toast.info('외부에서 파일이 변경되었습니다', {
            description: createElement(
              'ul',
              { className: 'mt-1 flex flex-col gap-0.5' },
              ...externalPdfs.map((p) =>
                createElement(
                  'li',
                  { key: p.id, className: 'flex items-center gap-1.5' },
                  createElement(FileText, { className: 'size-3.5 shrink-0' }),
                  p.title
                )
              )
            )
          })
        }
        externalPdfs.forEach((p) => {
          queryClient.refetchQueries({ queryKey: ['pdf', 'content', p.id] }).then(() => {
            window.dispatchEvent(
              new CustomEvent(PDF_EXTERNAL_CHANGED_EVENT, { detail: { pdfId: p.id } })
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

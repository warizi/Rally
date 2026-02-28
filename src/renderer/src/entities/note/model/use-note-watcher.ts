import { createElement, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'
import type { NoteNode } from './types'
import { isWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { isOwnWrite } from './own-write-tracker'

/** 외부 파일 변경 시 발생하는 커스텀 이벤트 이름 */
export const NOTE_EXTERNAL_CHANGED_EVENT = 'note:external-changed'

/** MainLayout에서 호출 — note:changed push 이벤트 구독 + React Query invalidation */
export function useNoteWatcher(): void {
  const queryClient = useQueryClient()
  const readyRef = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true
    }, 2000)
    const unsub = window.api.note.onChanged((workspaceId: string, changedRelPaths: string[]) => {
      // 노트 목록 무효화
      queryClient.invalidateQueries({ queryKey: ['note', 'workspace', workspaceId] })

      // 변경된 파일 중 외부 변경만 처리 (자체 저장은 스킵 → 포커스 유지)
      const notes = queryClient.getQueryData<NoteNode[]>(['note', 'workspace', workspaceId])
      if (notes && changedRelPaths.length > 0) {
        const externalNotes = notes.filter(
          (n) =>
            changedRelPaths.includes(n.relativePath) &&
            !isOwnWrite(n.id) &&
            !isWorkspaceOwnWrite(workspaceId)
        )
        if (readyRef.current && externalNotes.length > 0) {
          toast.info('외부에서 파일이 변경되었습니다', {
            description: createElement(
              'ul',
              { className: 'mt-1 flex flex-col gap-0.5' },
              ...externalNotes.map((n) =>
                createElement(
                  'li',
                  { key: n.id, className: 'flex items-center gap-1.5' },
                  createElement(FileText, { className: 'size-3.5 shrink-0' }),
                  n.title
                )
              )
            )
          })
        }
        externalNotes.forEach((n) => {
          // refetch 완료 후 이벤트 발행 → 에디터가 최신 내용으로 remount
          queryClient.refetchQueries({ queryKey: ['note', 'content', n.id] }).then(() => {
            window.dispatchEvent(
              new CustomEvent(NOTE_EXTERNAL_CHANGED_EVENT, { detail: { noteId: n.id } })
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

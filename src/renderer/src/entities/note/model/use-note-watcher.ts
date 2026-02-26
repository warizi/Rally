import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { NoteNode } from './types'
import { isOwnWrite } from './own-write-tracker'

/** 외부 파일 변경 시 발생하는 커스텀 이벤트 이름 */
export const NOTE_EXTERNAL_CHANGED_EVENT = 'note:external-changed'

/** MainLayout에서 호출 — note:changed push 이벤트 구독 + React Query invalidation */
export function useNoteWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.note.onChanged((workspaceId: string, changedRelPaths: string[]) => {
      // 노트 목록 무효화
      queryClient.invalidateQueries({ queryKey: ['note', 'workspace', workspaceId] })

      // 변경된 파일 중 외부 변경만 처리 (자체 저장은 스킵 → 포커스 유지)
      const notes = queryClient.getQueryData<NoteNode[]>(['note', 'workspace', workspaceId])
      if (notes && changedRelPaths.length > 0) {
        notes
          .filter((n) => changedRelPaths.includes(n.relativePath) && !isOwnWrite(n.id))
          .forEach((n) => {
            // refetch 완료 후 이벤트 발행 → 에디터가 최신 내용으로 remount
            queryClient.refetchQueries({ queryKey: ['note', 'content', n.id] }).then(() => {
              window.dispatchEvent(
                new CustomEvent(NOTE_EXTERNAL_CHANGED_EVENT, { detail: { noteId: n.id } })
              )
            })
          })
      }
    })
    return unsub
  }, [queryClient])
}

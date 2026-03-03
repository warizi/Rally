import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { NOTE_EXTERNAL_CHANGED_EVENT } from '@entities/note/model/use-note-watcher'

/**
 * 외부 파일 변경 감지 → 에디터 remount 트리거
 * @returns editorKey - MilkdownProvider의 key로 사용
 * @returns latestContent - 이벤트 시점 캐시에서 읽은 최신 내용 (null이면 initialContent 사용)
 */
export function useNoteExternalSync(noteId: string): {
  editorKey: number
  latestContent: string | null
} {
  const [editorKey, setEditorKey] = useState(0)
  const [latestContent, setLatestContent] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const handler = (e: Event): void => {
      if ((e as CustomEvent<{ noteId: string }>).detail.noteId === noteId) {
        // refetchQueries 완료 후 이 이벤트가 발생하므로 캐시는 이미 최신 상태
        // NotePage의 re-render를 기다리지 않고 캐시를 직접 읽어 race condition 방지
        const cached = queryClient.getQueryData<string>(['note', 'content', noteId])
        setLatestContent(cached ?? null)
        setEditorKey((k) => k + 1)
      }
    }
    window.addEventListener(NOTE_EXTERNAL_CHANGED_EVENT, handler)
    return () => window.removeEventListener(NOTE_EXTERNAL_CHANGED_EVENT, handler)
  }, [noteId, queryClient])

  return { editorKey, latestContent }
}

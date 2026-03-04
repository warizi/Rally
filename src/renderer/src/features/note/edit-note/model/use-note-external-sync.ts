import { MutableRefObject, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { NOTE_EXTERNAL_CHANGED_EVENT } from '@entities/note/model/use-note-watcher'

/**
 * 외부 파일 변경 및 캐시 변경 감지 → 에디터 remount 트리거
 * @param noteId - 노트 ID
 * @param initialContent - 부모에서 전달된 최신 캐시 content (React Query data)
 * @param lastSentRef - 이 인스턴스가 마지막으로 저장한 content (자체 쓰기 판별용)
 * @returns editorKey - MilkdownProvider의 key로 사용
 * @returns contentToMount - 에디터에 마운트할 content
 */
export function useNoteExternalSync(
  noteId: string,
  initialContent: string,
  lastSentRef: MutableRefObject<string | null>
): {
  editorKey: number
  contentToMount: string
} {
  const [editorKey, setEditorKey] = useState(0)
  const [overrideContent, setOverrideContent] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const prevContentRef = useRef(initialContent)

  // 1) 파일 감시 이벤트 (외부 앱에서 파일 수정 시)
  useEffect(() => {
    const handler = (e: Event): void => {
      if ((e as CustomEvent<{ noteId: string }>).detail.noteId === noteId) {
        const cached = queryClient.getQueryData<string>(['note', 'content', noteId])
        setOverrideContent(cached ?? null)
        setEditorKey((k) => k + 1)
      }
    }
    window.addEventListener(NOTE_EXTERNAL_CHANGED_EVENT, handler)
    return () => window.removeEventListener(NOTE_EXTERNAL_CHANGED_EVENT, handler)
  }, [noteId, queryClient])

  // 2) 캐시 변경 감지 (같은 프로세스 내 다른 인스턴스의 setQueryData)
  useEffect(() => {
    if (prevContentRef.current === initialContent) return
    prevContentRef.current = initialContent
    // 내 쓰기 → skip
    if (lastSentRef.current === initialContent) {
      lastSentRef.current = null
      return
    }
    // 외부 변경 → remount (initialContent가 이미 최신이므로 override 불필요)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOverrideContent(null)
    setEditorKey((k) => k + 1)
  }, [initialContent, lastSentRef])

  return { editorKey, contentToMount: overrideContent ?? initialContent }
}

import { useEffect, useState } from 'react'
import { NOTE_EXTERNAL_CHANGED_EVENT } from '@entities/note/model/use-note-watcher'

/**
 * 외부 파일 변경 감지 → 에디터 remount 트리거
 * @returns editorKey - MilkdownProvider의 key로 사용
 */
export function useNoteExternalSync(noteId: string): { editorKey: number } {
  const [editorKey, setEditorKey] = useState(0)

  useEffect(() => {
    const handler = (e: Event): void => {
      if ((e as CustomEvent<{ noteId: string }>).detail.noteId === noteId) {
        setEditorKey((k) => k + 1)
      }
    }
    window.addEventListener(NOTE_EXTERNAL_CHANGED_EVENT, handler)
    return () => window.removeEventListener(NOTE_EXTERNAL_CHANGED_EVENT, handler)
  }, [noteId])

  return { editorKey }
}

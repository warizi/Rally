import { JSX, useCallback, useEffect, useRef } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { commonmark } from '@milkdown/preset-commonmark'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { useWriteNoteContent } from '@entities/note'
import { useNoteExternalSync } from '../model/use-note-external-sync'

interface MilkdownEditorProps {
  initialContent: string
  onSave: (markdown: string) => void
}

function MilkdownEditor({ initialContent, onSave }: MilkdownEditorProps): JSX.Element {
  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initialContent)
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onSave(markdown)
        })
      })
      .use(commonmark)
      .use(listener)
  )
  return <Milkdown />
}

interface NoteEditorProps {
  workspaceId: string
  noteId: string
  initialContent: string
}

export function NoteEditor({ workspaceId, noteId, initialContent }: NoteEditorProps): JSX.Element {
  const { mutate: writeContent } = useWriteNoteContent()
  const { editorKey, latestContent } = useNoteExternalSync(noteId)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const handleSave = useCallback(
    (markdown: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        writeContent({ workspaceId, noteId, content: markdown })
      }, 800)
    },
    [workspaceId, noteId, writeContent]
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // 외부 변경 시: 캐시에서 직접 읽은 latestContent 사용 (race condition 방지)
  // 초기 마운트 시: NotePage에서 전달된 initialContent 사용
  const contentToMount = latestContent ?? initialContent

  return (
    <div className="h-full">
      <MilkdownProvider key={editorKey}>
        <MilkdownEditor initialContent={contentToMount} onSave={handleSave} />
      </MilkdownProvider>
    </div>
  )
}

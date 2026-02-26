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
  const { editorKey } = useNoteExternalSync(noteId)

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

  return (
    <div className="h-full">
      <MilkdownProvider key={editorKey}>
        <MilkdownEditor initialContent={initialContent} onSave={handleSave} />
      </MilkdownProvider>
      <div className="h-full bg-red-500" />
    </div>
  )
}

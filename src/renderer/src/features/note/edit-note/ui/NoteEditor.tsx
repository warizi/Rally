import { JSX, useCallback, useEffect, useRef } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react'
import { commonmark, imageSchema, insertImageCommand } from '@milkdown/preset-commonmark'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { upload, uploadConfig } from '@milkdown/kit/plugin/upload'
import { $view, callCommand } from '@milkdown/kit/utils'
import { useWriteNoteContent } from '@entities/note'
import { useNoteExternalSync } from '../model/use-note-external-sync'
import { createNoteImageNodeViewFactory } from '../model/note-image-node-view'

/** 저장 시: 문단 사이 빈 줄 제거, <br /> → 빈 줄로 변환 */
function compactMarkdown(md: string): string {
  return md
    .replace(/\n{2,}/g, '\n') // 문단 구분 \n\n → \n
    .replace(/^<br\s*\/?\s*>$/gm, '') // <br /> 줄 → 빈 줄 (의도적 빈 줄 보존)
}

function isBlockMarker(line: string): boolean {
  const t = line.trimStart()
  return (
    t.startsWith('#') ||
    t.startsWith('- ') ||
    t.startsWith('* ') ||
    t.startsWith('+ ') ||
    t.startsWith('> ') ||
    t.startsWith('```') ||
    t.startsWith('---') ||
    t.startsWith('|') ||
    /^\d+\.\s/.test(t)
  )
}

/** 로드 시: 연속된 텍스트 줄 사이에 \n\n 복원, 빈 줄 → <br /> 복원 */
function expandMarkdown(md: string): string {
  const lines = md.split('\n')
  const result: string[] = []
  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trimStart().startsWith('```')) inCodeBlock = !inCodeBlock

    // 빈 줄 → <br /> (의도적 빈 줄을 에디터 빈 문단으로 복원)
    if (!inCodeBlock && line.trim() === '' && i > 0 && i < lines.length - 1) {
      result.push('')
      result.push('<br />')
      result.push('')
      continue
    }

    result.push(line)

    if (inCodeBlock || i === lines.length - 1) continue
    if (line.trim() === '') continue

    const next = lines[i + 1]
    if (next === undefined || next.trim() === '') continue

    // 둘 다 일반 텍스트(블록 마커 아님)이면 문단 구분 빈 줄 삽입
    if (!isBlockMarker(line) && !isBlockMarker(next)) {
      result.push('')
    }
  }

  return result.join('\n')
}

async function saveDroppedFile(
  workspaceId: string,
  file: File
): Promise<string | null> {
  const filePath = window.electron.webUtils.getPathForFile(file)
  if (filePath) {
    const res = await window.api.noteImage.saveFromPath(workspaceId, filePath)
    return res.success ? res.data! : null
  }
  const buffer = await file.arrayBuffer()
  const ext = file.name.split('.').pop() || 'png'
  const res = await window.api.noteImage.saveFromBuffer(workspaceId, buffer, ext)
  return res.success ? res.data! : null
}

interface MilkdownEditorProps {
  workspaceId: string
  initialContent: string
  onSave: (markdown: string) => void
}

function MilkdownEditor({ workspaceId, initialContent, onSave }: MilkdownEditorProps): JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [loading, getEditor] = useInstance()

  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, expandMarkdown(initialContent))
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onSave(markdown)
        })
        ctx.update(uploadConfig.key, (prev) => ({
          ...prev,
          uploader: async (files: FileList, schema) => {
            const nodes: import('@milkdown/kit/prose/model').Node[] = []
            for (let i = 0; i < files.length; i++) {
              const file = files.item(i)
              if (!file || !file.type.startsWith('image/')) continue
              const relativePath = await saveDroppedFile(workspaceId, file)
              if (!relativePath) continue
              const node = schema.nodes.image.createAndFill({
                src: relativePath,
                alt: file.name
              })
              if (node) nodes.push(node)
            }
            return nodes
          }
        }))
      })
      .use(commonmark)
      .use(listener)
      .use(upload)
      .use(
        $view(imageSchema.node, (_ctx) =>
          createNoteImageNodeViewFactory(workspaceId)
        )
      )
  )

  // DnD: 드롭 시 이미지 삽입
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const onDragOver = (e: DragEvent): void => {
      e.preventDefault()
    }

    const onDrop = async (e: DragEvent): Promise<void> => {
      e.preventDefault()
      e.stopPropagation()

      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      const editor = getEditor()
      if (!editor) return

      for (let i = 0; i < files.length; i++) {
        const file = files.item(i)
        if (!file || !file.type.startsWith('image/')) continue
        const relativePath = await saveDroppedFile(workspaceId, file)
        if (!relativePath) continue
        editor.action(callCommand(insertImageCommand.key, { src: relativePath, alt: file.name }))
      }
    }

    el.addEventListener('dragover', onDragOver)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('drop', onDrop)
    }
  }, [loading, workspaceId, getEditor])

  return (
    <div ref={wrapperRef} className="h-full">
      <Milkdown />
    </div>
  )
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
        writeContent({ workspaceId, noteId, content: compactMarkdown(markdown) })
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
        <MilkdownEditor workspaceId={workspaceId} initialContent={contentToMount} onSave={handleSave} />
      </MilkdownProvider>
    </div>
  )
}

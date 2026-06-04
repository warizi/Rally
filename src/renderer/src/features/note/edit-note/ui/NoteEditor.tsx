import { JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  remarkPluginsCtx,
  remarkStringifyOptionsCtx
} from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react'
import { commonmark, imageSchema, insertImageCommand } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { history } from '@milkdown/kit/plugin/history'
import { upload, uploadConfig } from '@milkdown/kit/plugin/upload'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { $view, callCommand } from '@milkdown/kit/utils'
import { useWriteNoteContent } from '@entities/note'
import { useSyntaxHintSetting } from '@/shared/hooks/use-syntax-hint-setting'
import { useSpellcheckSetting } from '@/shared/hooks/use-spellcheck-setting'
import {
  configureRallyCodeBlock,
  rallyCodeBlockPlugins
} from '@/shared/lib/note-code-block-highlighting'
import { useNoteExternalSync } from '../model/use-note-external-sync'
import { createNoteImageNodeViewFactory } from '../model/note-image-node-view'
import { noteSearchPlugin } from '../model/note-search-plugin'
import { autolinkPlugin } from '../model/note-link-input-rule'
import { syntaxHintPlugin } from '../model/note-syntax-hint-plugin'
import { noteTabIndentPlugin } from '../model/note-tab-indent-plugin'
import { notePasteNormalizePlugin } from '../model/note-paste-normalize'
import {
  colorMarkSchema,
  colorSpanRemarkPlugin,
  colorSpanStringifyHandler,
  COLOR_SPAN_MDAST_TYPE
} from '../model/note-color-mark'
import {
  rallyEmbedSchema,
  rallyEmbedRemarkPlugin,
  rallyEmbedStringifyHandler,
  RALLY_EMBED_MDAST_TYPE
} from '../model/note-embed-schema'
import { createNoteEmbedNodeViewFactory } from '../model/note-embed-node-view'
import { createEmbedPickerPlugin } from '../model/embed-picker-plugin'
import { embedProtectPlugin } from '../model/embed-protect-plugin'
import { EmbedPicker } from './EmbedPicker'
import { EmbedPortals } from './EmbedPortals'
import { noteToolbarStatePlugin } from '../model/note-toolbar-state-plugin'
import { toggleColorCommand } from '../model/note-toolbar-commands'
import { NoteSearchBar } from './NoteSearchBar'
import { NoteFloatingToolbar } from './NoteFloatingToolbar'

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

async function saveDroppedFile(workspaceId: string, file: File): Promise<string | null> {
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
  searchOpen: boolean
  onSearchOpen: () => void
  onSearchClose: () => void
}

function MilkdownEditor({
  workspaceId,
  initialContent,
  onSave,
  searchOpen,
  onSearchOpen,
  onSearchClose
}: MilkdownEditorProps): JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  // 한 페이지에 NoteEditor 가 여러 개 (탭 + 캔버스 노드) 떠 있을 때 embed
  // picker / portal store 가 cross-contamination 되지 않도록 인스턴스 단위 id.
  const editorId = useMemo(() => nanoid(), [])
  const [loading, getEditor] = useInstance()
  // editorRef.current 는 초기 렌더 시 null 이라 useState 로 mount 후 캡처
  // → NoteFloatingToolbar 가 toolbar-state 이벤트 listener 를 정확한 DOM 에 부착.
  const [toolbarHostEl, setToolbarHostEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (loading) return
    setToolbarHostEl(editorRef.current)
  }, [loading])

  // 문법 검사(spellcheck) 설정 → ProseMirror contenteditable 의 spellcheck 속성에 반영.
  const { show: spellcheckOn } = useSpellcheckSetting()
  useEffect(() => {
    if (loading) return
    const pm = wrapperRef.current?.querySelector('.ProseMirror')
    pm?.setAttribute('spellcheck', String(spellcheckOn))
  }, [loading, spellcheckOn])

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
        // 색상 mark — paired <span style="color:..."> 처리:
        // (1) remark 플러그인이 mdast 의 paired html span 을 colorSpan 노드로 wrapping
        // (2) remark-stringify 핸들러가 colorSpan 노드를 raw HTML span 으로 직렬화
        ctx.update(remarkPluginsCtx, (prev) => [
          ...prev,
          { plugin: colorSpanRemarkPlugin, options: {} },
          { plugin: rallyEmbedRemarkPlugin, options: {} }
        ])
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          handlers: {
            ...prev.handlers,
            [COLOR_SPAN_MDAST_TYPE]: colorSpanStringifyHandler,
            [RALLY_EMBED_MDAST_TYPE]: rallyEmbedStringifyHandler
          }
        }))
        configureRallyCodeBlock(ctx)
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(upload)
      // 표 줄 사이에 빈 줄을 끼워 복사하는 도구(옵시디언 등) 호환 — clipboard 전에 실행.
      .use(notePasteNormalizePlugin)
      .use(clipboard)
      .use(noteSearchPlugin)
      .use(autolinkPlugin)
      .use(syntaxHintPlugin)
      .use(noteTabIndentPlugin)
      .use(colorMarkSchema)
      .use(toggleColorCommand)
      .use(rallyEmbedSchema)
      .use(createEmbedPickerPlugin(editorId))
      .use(embedProtectPlugin)
      .use(noteToolbarStatePlugin)
      .use(rallyCodeBlockPlugins)
      .use($view(imageSchema.node, () => createNoteImageNodeViewFactory(workspaceId)))
      .use(
        $view(rallyEmbedSchema.node, () => createNoteEmbedNodeViewFactory(workspaceId, editorId))
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
      // ProseMirror 의 upload plugin 이 에디터 영역 안 드롭은 자체 처리한다
      // (uploadConfig.uploader). wrapper 리스너까지 같은 이벤트로 또 삽입하면
      // 이미지가 2 번 들어가므로, 에디터 내부 드롭은 skip 한다.
      const target = e.target as HTMLElement | null
      if (target?.closest('.ProseMirror')) return

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

  const handleBottomClick = useCallback(() => {
    const editor = getEditor()
    if (!editor) return
    // 에디터 끝으로 포커스 이동
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { doc } = view.state
      const end = doc.content.size
      view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, end)))
      view.focus()
    })
  }, [getEditor])

  // 링크 Cmd+Click → 외부 브라우저 열기 (mousedown capture로 ProseMirror보다 먼저 처리)
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const onMouseDown = (e: MouseEvent): void => {
      if (!e.metaKey && !e.ctrlKey) return
      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (href && /^https?:\/\//.test(href)) {
        e.preventDefault()
        e.stopPropagation()
        window.shell.openExternal(href)
      }
    }
    el.addEventListener('mousedown', onMouseDown, true)
    return () => el.removeEventListener('mousedown', onMouseDown, true)
  }, [])

  // Cmd+F 검색 열기 (document 레벨에서 캡처하여 Electron 내장 Find 방지)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        // 에디터에 포커스가 있거나 검색바에 포커스가 있을 때만 동작
        const el = wrapperRef.current
        if (!el) return
        if (!el.contains(document.activeElement)) return
        e.preventDefault()
        e.stopPropagation()
        onSearchOpen()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onSearchOpen])

  return (
    <div ref={wrapperRef} className="h-full relative">
      <div className="sticky top-0 z-10">
        <NoteSearchBar open={searchOpen} onClose={onSearchClose} />
      </div>
      <div ref={editorRef}>
        <Milkdown />
      </div>
      <div className="h-[300px] shrink-0 cursor-text" onClick={handleBottomClick} />
      <NoteFloatingToolbar editorEl={toolbarHostEl} />
      <EmbedPicker workspaceId={workspaceId} editorId={editorId} />
      <EmbedPortals editorId={editorId} />
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
  const lastSentRef = useRef<string | null>(null)
  const { editorKey, contentToMount } = useNoteExternalSync(noteId, initialContent, lastSentRef)
  const [searchOpen, setSearchOpen] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const handleSave = useCallback(
    (markdown: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const compacted = compactMarkdown(markdown)
        lastSentRef.current = compacted
        writeContent({ workspaceId, noteId, content: compacted })
      }, 800)
    },
    [workspaceId, noteId, writeContent]
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // 설정 off 면 .syntax-hint 를 CSS 로 숨김 (에디터 재생성 없이 즉시 반영)
  const { show: syntaxHintShow } = useSyntaxHintSetting()

  return (
    <div className={`h-full${syntaxHintShow ? '' : ' rally-syntax-hint-off'}`} data-rally-note>
      <MilkdownProvider key={editorKey}>
        <MilkdownEditor
          workspaceId={workspaceId}
          initialContent={contentToMount}
          onSave={handleSave}
          searchOpen={searchOpen}
          onSearchOpen={() => setSearchOpen(true)}
          onSearchClose={() => setSearchOpen(false)}
        />
      </MilkdownProvider>
    </div>
  )
}

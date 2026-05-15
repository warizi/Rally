/**
 * 노트 에디터 floating toolbar.
 *
 * 텍스트 드래그 시 선택 영역 위에 popup 으로 나타나서 4가지 mark 토글 제공:
 *  - 기울임 (italic)
 *  - 굵게 (bold)
 *  - 인라인 코드 (inline code)
 *  - 색상 (8 슬롯 단일 팔레트 + 색 제거)
 *
 * ProseMirror selection 변경은 `noteToolbarStatePlugin` 이 dispatch 하는
 * `note-toolbar-state` 커스텀 이벤트로 받음. composing(IME) 중에는 자동 숨김.
 */
import { useEffect, useState } from 'react'
import { useInstance } from '@milkdown/react'
import { callCommand } from '@milkdown/kit/utils'
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand
} from '@milkdown/kit/preset/commonmark'
import { ItalicIcon, BoldIcon, CodeIcon, BanIcon } from 'lucide-react'
import { useToolbarPalette } from '@entities/note-toolbar-palette'
import { toggleColorCommand } from '../model/note-toolbar-commands'
import { TOOLBAR_STATE_EVENT, type ToolbarStateDetail } from '../model/note-toolbar-state-plugin'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { cn } from '@/shared/lib/utils'

interface NoteFloatingToolbarProps {
  /** Milkdown editor 의 DOM wrapper. 여기에 toolbar-state 이벤트 listener 를 부착. */
  editorEl: HTMLElement | null
}

export function NoteFloatingToolbar({
  editorEl
}: NoteFloatingToolbarProps): React.JSX.Element | null {
  const [state, setState] = useState<ToolbarStateDetail>({ visible: false })
  const [, getEditor] = useInstance()
  const { palette } = useToolbarPalette()
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false)

  useEffect(() => {
    if (!editorEl) return
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<ToolbarStateDetail>).detail
      setState(detail)
      if (!detail.visible) setColorPopoverOpen(false)
    }
    editorEl.addEventListener(TOOLBAR_STATE_EVENT, handler)
    return () => editorEl.removeEventListener(TOOLBAR_STATE_EVENT, handler)
  }, [editorEl])

  if (!state.visible || !state.rect) return null

  const runCommand = (commandKey: Parameters<typeof callCommand>[0], payload?: unknown): void => {
    const editor = getEditor()
    if (!editor) return
    editor.action(callCommand(commandKey, payload))
  }

  const onToggleItalic = (): void => runCommand(toggleEmphasisCommand.key)
  const onToggleBold = (): void => runCommand(toggleStrongCommand.key)
  const onToggleInlineCode = (): void => runCommand(toggleInlineCodeCommand.key)
  const onApplyColor = (color: string): void => {
    runCommand(toggleColorCommand.key, color)
    setColorPopoverOpen(false)
  }
  const onRemoveColor = (): void => {
    runCommand(toggleColorCommand.key, undefined)
    setColorPopoverOpen(false)
  }

  const active = state.activeMarks ?? {
    italic: false,
    bold: false,
    inlineCode: false
  }
  const currentColor = active.color

  const TOOLBAR_OFFSET = 8
  const style: React.CSSProperties = {
    position: 'fixed',
    top: `${state.rect.top - TOOLBAR_OFFSET}px`,
    left: `${state.rect.left + state.rect.width / 2}px`,
    transform: 'translate(-50%, -100%)',
    zIndex: 50
  }

  return (
    <div
      style={style}
      className="flex items-center gap-0.5 rounded-md border border-border bg-popover text-popover-foreground shadow-md p-1"
      role="toolbar"
      aria-label="텍스트 서식"
      data-testid="note-floating-toolbar"
      onMouseDown={(e) => e.preventDefault()}
    >
      <ToolbarButton
        label="기울임"
        active={active.italic}
        onClick={onToggleItalic}
        data-testid="floating-toolbar-italic"
      >
        <ItalicIcon className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="굵게"
        active={active.bold}
        onClick={onToggleBold}
        data-testid="floating-toolbar-bold"
      >
        <BoldIcon className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="인라인 코드"
        active={active.inlineCode}
        onClick={onToggleInlineCode}
        data-testid="floating-toolbar-code"
      >
        <CodeIcon className="size-3.5" />
      </ToolbarButton>

      <Popover open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors',
              'hover:bg-accent hover:text-accent-foreground cursor-pointer',
              currentColor && 'bg-accent'
            )}
            aria-label="색상"
            data-testid="floating-toolbar-color-trigger"
            onMouseDown={(e) => e.preventDefault()}
          >
            <span
              className="inline-block size-3.5 rounded-full border border-border"
              style={{ backgroundColor: currentColor ?? 'transparent' }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-2"
          align="center"
          side="bottom"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="grid grid-cols-4 gap-1" data-testid="floating-toolbar-color-grid">
            {palette.map((c, i) => (
              <button
                key={i}
                onClick={() => onApplyColor(c)}
                className={cn(
                  'size-7 rounded-md border border-border cursor-pointer hover:scale-110 transition-transform',
                  currentColor?.toLowerCase() === c.toLowerCase() && 'ring-2 ring-ring'
                )}
                style={{ backgroundColor: c }}
                aria-label={`색상 슬롯 ${i + 1}`}
                data-testid={`floating-toolbar-color-slot-${i}`}
              />
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-border">
            <button
              onClick={onRemoveColor}
              className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
              data-testid="floating-toolbar-color-remove"
            >
              <BanIcon className="size-3" />색 제거
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
  ...rest
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        'inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors cursor-pointer',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'
      )}
      aria-label={label}
      aria-pressed={active}
      {...rest}
    >
      {children}
    </button>
  )
}

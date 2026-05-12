import { useState } from 'react'
import { RotateCcwIcon, TrashIcon, BookmarkPlusIcon } from 'lucide-react'
import {
  DEFAULT_NOTE_STYLE_SETTINGS,
  STYLE_ELEMENT_KEYS,
  buildNoteStyleCss,
  useCreateNoteStyleTemplate,
  useDeleteNoteStyleTemplate,
  useNoteStyle,
  useNoteStyleTemplates,
  type ElementStyle,
  type NoteStyleSet,
  type NoteStyleSettings,
  type StyleElementKey,
  type ThemeMode
} from '@entities/note-style'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Separator } from '@/shared/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { cn } from '@/shared/lib/utils'

const ELEMENT_LABEL: Record<StyleElementKey, string> = {
  h1: 'H1',
  h2: 'H2',
  h3: 'H3',
  h4: 'H4',
  h5: 'H5',
  h6: 'H6',
  paragraph: '본문',
  codeInline: '인라인 코드',
  codeBlock: '코드 블록',
  blockquote: '인용구'
}

export function NoteSettings(): React.JSX.Element {
  const { settings, isLoading, save, saveMode, resetMode } = useNoteStyle()
  const [mode, setMode] = useState<ThemeMode>('light')
  const [activeElement, setActiveElement] = useState<StyleElementKey>('h1')

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">불러오는 중…</div>
  }

  const currentSet = settings[mode]
  const currentElement = currentSet[activeElement]

  const updateElement = (patch: Partial<ElementStyle>): void => {
    const nextSet: NoteStyleSet = {
      ...currentSet,
      [activeElement]: { ...currentElement, ...patch }
    }
    saveMode(mode, nextSet)
  }

  return (
    <div className="space-y-4">
      {/* 상단: 모드 토글 + 초기화 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">노트 마크다운 스타일</h3>
          <p className="text-xs text-muted-foreground">
            라이트/다크 모드별로 각 요소의 스타일을 조절합니다.
          </p>
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          value={mode}
          onValueChange={(v) => v && setMode(v as ThemeMode)}
          variant="outline"
        >
          <ToggleGroupItem value="light" className="text-xs">
            라이트
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" className="text-xs">
            다크
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Separator />

      {/* 요소 선택 */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">요소</Label>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_ELEMENT_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setActiveElement(key)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs border transition-colors cursor-pointer',
                activeElement === key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {ELEMENT_LABEL[key]}
            </button>
          ))}
        </div>
      </div>

      {/* 5개 속성 컨트롤 */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="크기">
          <Input
            value={currentElement.fontSize}
            onChange={(e) => updateElement({ fontSize: e.target.value })}
            placeholder="예: 16px"
            className="h-8 text-sm"
          />
        </Field>
        <Field label="줄 높이">
          <Input
            type="number"
            step="0.05"
            min="0.5"
            value={currentElement.lineHeight}
            onChange={(e) => updateElement({ lineHeight: parseFloat(e.target.value) || 1 })}
            className="h-8 text-sm"
          />
        </Field>
        <Field label="상단 여백">
          <Input
            value={currentElement.marginTop}
            onChange={(e) => updateElement({ marginTop: e.target.value })}
            placeholder="예: 16px"
            className="h-8 text-sm"
          />
        </Field>
        <Field label="하단 여백">
          <Input
            value={currentElement.marginBottom}
            onChange={(e) => updateElement({ marginBottom: e.target.value })}
            placeholder="예: 16px"
            className="h-8 text-sm"
          />
        </Field>
        <Field label="색상">
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={currentElement.color}
              onChange={(e) => updateElement({ color: e.target.value })}
              className="h-8 w-12 p-1 cursor-pointer"
            />
            <Input
              value={currentElement.color}
              onChange={(e) => updateElement({ color: e.target.value })}
              className="h-8 text-sm font-mono"
            />
          </div>
        </Field>
        <div className="flex items-end justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetMode(mode)}
            className="h-8 gap-1.5"
          >
            <RotateCcwIcon className="size-3" />
            {mode === 'light' ? '라이트' : '다크'} 초기화
          </Button>
        </div>
      </div>

      <Separator />

      {/* 미리보기 */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">미리보기</Label>
        <NoteStylePreview set={currentSet} mode={mode} />
      </div>

      <Separator />

      {/* 템플릿 */}
      <TemplateSection settings={settings} onApply={save} />
    </div>
  )
}

function TemplateSection({
  settings,
  onApply
}: {
  settings: NoteStyleSettings
  onApply: (next: NoteStyleSettings) => void
}): React.JSX.Element {
  const { templates } = useNoteStyleTemplates()
  const { create, isPending: isCreating } = useCreateNoteStyleTemplate()
  const { remove } = useDeleteNoteStyleTemplate()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async (): Promise<void> => {
    setError(null)
    const trimmed = newName.trim()
    if (!trimmed) {
      setError('템플릿 이름을 입력하세요.')
      return
    }
    try {
      await create({ name: trimmed, settingsJson: JSON.stringify(settings) })
      setNewName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '템플릿 저장 실패')
    }
  }

  const handleApply = (template: { settingsJson: string }): void => {
    try {
      const parsed = JSON.parse(template.settingsJson) as NoteStyleSettings
      onApply({
        light: { ...DEFAULT_NOTE_STYLE_SETTINGS.light, ...(parsed.light ?? {}) },
        dark: { ...DEFAULT_NOTE_STYLE_SETTINGS.dark, ...(parsed.dark ?? {}) }
      })
    } catch {
      setError('템플릿 데이터가 손상되었습니다.')
    }
  }

  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-2 block">템플릿</Label>

      <div className="flex items-center gap-2 mb-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="현재 설정을 템플릿으로 저장 (이름 입력)"
          className="h-8 text-sm flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleCreate()
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleCreate()}
          disabled={isCreating}
          className="h-8 gap-1.5"
        >
          <BookmarkPlusIcon className="size-3" />
          저장
        </Button>
      </div>

      {error && <div className="text-xs text-destructive mb-2">{error}</div>}

      {templates.length === 0 ? (
        <div className="text-xs text-muted-foreground italic py-2">저장된 템플릿이 없습니다.</div>
      ) : (
        <ul className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-1.5">
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-accent/40"
            >
              <span className="text-sm truncate flex-1">{t.name}</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleApply(t)}
                >
                  적용
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => void remove(t.id)}
                >
                  <TrashIcon className="size-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

/**
 * Lorem preview — 편집 중인 `set` 을 inline `<style>` 로 주입.
 *
 * 미리보기는 현재 화면 테마와 무관하게 사용자가 편집 중인 mode 로 표시되어야 한다.
 * `useRuntimeNoteStyles` 가 mount 한 전역 `<style>` 은 현재 화면 테마만 반영하므로,
 * 미리보기에는 별도 selector (`data-rally-note-preview`) 로 set 을 주입한다.
 */
function NoteStylePreview({
  set,
  mode
}: {
  set: NoteStyleSet
  mode: ThemeMode
}): React.JSX.Element {
  const isDark = mode === 'dark'
  const css = buildNoteStyleCss(set, '[data-rally-note-preview]')

  return (
    <div
      data-rally-note-preview
      className={cn(
        'rounded-md border p-4 max-h-64 overflow-y-auto',
        isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'
      )}
    >
      <style>{css}</style>
      <h1>제목 1: Rally 노트 미리보기</h1>
      <p>
        본문 텍스트입니다. 마크다운 요소별 스타일이 실시간으로 반영됩니다. 인라인 코드는{' '}
        <code>inlineCode()</code> 형식으로 표시됩니다.
      </p>
      <h2>제목 2: 소제목</h2>
      <p>두 번째 단락. 줄 간격과 색상도 함께 조정할 수 있습니다.</p>
      <h3>제목 3</h3>
      <h4>제목 4</h4>
      <h5>제목 5</h5>
      <h6>제목 6</h6>
      <blockquote>
        인용구는 글의 핵심을 강조할 때 사용합니다. 좌측 보더와 들여쓰기로 구분됩니다.
      </blockquote>
      <pre>
        <code>{`function preview() {\n  return 'code block sample'\n}`}</code>
      </pre>
    </div>
  )
}

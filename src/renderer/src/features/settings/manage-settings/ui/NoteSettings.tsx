import { useState } from 'react'
import { MinusIcon, PlusIcon, RotateCcwIcon, TrashIcon, BookmarkPlusIcon } from 'lucide-react'
import { Editor, defaultValueCtx, editorViewOptionsCtx, rootCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import {
  ELEMENTS_WITH_BACKGROUND,
  ELEMENTS_WITH_BORDER,
  ELEMENTS_WITHOUT_TEXT,
  STYLE_ELEMENT_KEYS,
  buildNoteStyleCss,
  formatSize,
  parseNoteStyleSettings,
  parseSize,
  useCreateNoteStyleTemplate,
  useDeleteNoteStyleTemplate,
  useNoteStyle,
  useNoteStyleTemplates,
  type ElementStyle,
  type NoteStyleSettings,
  type StyleElementKey
} from '@entities/note-style'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Separator } from '@/shared/ui/separator'
import { cn } from '@/shared/lib/utils'

const PREVIEW_MARKDOWN = `# 제목 1: Rally 노트 미리보기

본문 텍스트입니다. 마크다운 요소별 스타일이 실시간으로 반영됩니다. 인라인 코드는 \`inlineCode()\` 형식으로 표시됩니다.

본문 텍스트 1

본문 텍스트 2

## 제목 2: 소제목

두 번째 단락. 줄 간격과 색상도 함께 조정할 수 있습니다.

### 제목 3

#### 제목 4

##### 제목 5

###### 제목 6

> 인용구는 글의 핵심을 강조할 때 사용합니다. 좌측 보더와 들여쓰기로 구분됩니다.

---

구분선(hr) 위/아래 본문입니다.

\`\`\`
function preview() {
  return 'code block sample'
}
\`\`\`
`

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
  blockquote: '인용구',
  hr: '구분선'
}

export function NoteSettings(): React.JSX.Element {
  const { settings, isLoading, save, reset } = useNoteStyle()
  const [activeElement, setActiveElement] = useState<StyleElementKey>('h1')

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">불러오는 중…</div>
  }

  const currentElement = settings[activeElement]

  const updateElement = (patch: Partial<ElementStyle>): void => {
    save({
      ...settings,
      [activeElement]: { ...currentElement, ...patch }
    })
  }

  return (
    <div className="space-y-4">
      {/* 상단: 설명 + 초기화 버튼 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">노트 마크다운 스타일</h3>
          <p className="text-xs text-muted-foreground">
            각 요소의 크기·여백·색상을 조절합니다. 색상은 라이트/다크 모드별로 분리.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => reset()} className="h-8 gap-1.5">
          <RotateCcwIcon className="size-3" />
          초기화
        </Button>
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

      {/* 속성 컨트롤 */}
      <div className="grid grid-cols-2 gap-3">
        {!ELEMENTS_WITHOUT_TEXT.has(activeElement) && (
          <>
            <Field label="크기">
              <SizeInput
                value={currentElement.fontSize}
                onChange={(next) => updateElement({ fontSize: next })}
              />
            </Field>
            <Field label="줄 높이">
              <NumberStepper
                value={currentElement.lineHeight}
                onChange={(next) => updateElement({ lineHeight: next })}
                step={0.05}
                min={0.5}
                max={3}
              />
            </Field>
          </>
        )}
        <Field label="상단 여백">
          <SizeInput
            value={currentElement.marginTop}
            onChange={(next) => updateElement({ marginTop: next })}
          />
        </Field>
        <Field label="하단 여백">
          <SizeInput
            value={currentElement.marginBottom}
            onChange={(next) => updateElement({ marginBottom: next })}
          />
        </Field>
        {!ELEMENTS_WITHOUT_TEXT.has(activeElement) && (
          <>
            <Field label="글자색 (라이트)">
              <ColorInput
                value={currentElement.colorLight}
                onChange={(next) => updateElement({ colorLight: next })}
              />
            </Field>
            <Field label="글자색 (다크)">
              <ColorInput
                value={currentElement.colorDark}
                onChange={(next) => updateElement({ colorDark: next })}
              />
            </Field>
          </>
        )}
        {ELEMENTS_WITH_BACKGROUND.has(activeElement) && (
          <>
            <Field label="배경색 (라이트)">
              <ColorInput
                value={currentElement.backgroundLight}
                onChange={(next) => updateElement({ backgroundLight: next })}
              />
            </Field>
            <Field label="배경색 (다크)">
              <ColorInput
                value={currentElement.backgroundDark}
                onChange={(next) => updateElement({ backgroundDark: next })}
              />
            </Field>
          </>
        )}
        {ELEMENTS_WITH_BORDER.has(activeElement) && (
          <>
            <Field label={activeElement === 'hr' ? '선 색상 (라이트)' : '경계선 색상 (라이트)'}>
              <ColorInput
                value={currentElement.borderColorLight}
                onChange={(next) => updateElement({ borderColorLight: next })}
              />
            </Field>
            <Field label={activeElement === 'hr' ? '선 색상 (다크)' : '경계선 색상 (다크)'}>
              <ColorInput
                value={currentElement.borderColorDark}
                onChange={(next) => updateElement({ borderColorDark: next })}
              />
            </Field>
            <Field label={activeElement === 'hr' ? '선 굵기' : '경계선 굵기'}>
              <BorderWidthInput
                value={currentElement.borderWidth}
                onChange={(next) => updateElement({ borderWidth: next })}
              />
            </Field>
          </>
        )}
      </div>

      <Separator />

      {/* 미리보기 — 내부 light/dark 토글로 강제 모드 표시 */}
      <NoteStylePreview set={settings} />

      <Separator />

      {/* 템플릿 */}
      <TemplateSection settings={settings} onApply={save} />
    </div>
  )
}

const SIZE_STEP = 0.05
const SIZE_MIN = 0
const SIZE_MAX = 20 // rem 기준 합리적 상한 (20rem ≈ 320px)

/**
 * 숫자 입력 + 좌우 [−][+] 스테퍼 (공통).
 */
function NumberStepper({
  value,
  onChange,
  step,
  min,
  max,
  suffix
}: {
  value: number
  onChange: (next: number) => void
  step: number
  min?: number
  max?: number
  suffix?: string
}): React.JSX.Element {
  const clamp = (n: number): number => {
    let v = n
    if (typeof min === 'number') v = Math.max(min, v)
    if (typeof max === 'number') v = Math.min(max, v)
    return v
  }
  // 부동소수 누적 오차 보정 + UX (예: 1.875 + 0.05 = 1.9250000001 → 1.93)
  const round2 = (n: number): number => Math.round(n * 100) / 100
  const commit = (n: number): void => {
    if (!Number.isFinite(n)) {
      onChange(min ?? 0)
      return
    }
    onChange(clamp(round2(n)))
  }
  // 외부에서 들어온 value 가 길면 (예: px→rem 환산 0.28125) 표시는 2자리로
  const displayValue = round2(value)

  return (
    <div
      className={cn(
        'flex items-center h-8 rounded-md border border-input bg-transparent',
        'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        'transition-[color,box-shadow]'
      )}
    >
      <StepperButton ariaLabel="감소" onClick={() => commit(value - step)}>
        <MinusIcon className="size-3" />
      </StepperButton>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={displayValue}
        onChange={(e) => commit(parseFloat(e.target.value))}
        className={cn(
          'flex-1 min-w-0 h-full bg-transparent px-1 text-sm text-center outline-none',
          '[appearance:textfield]',
          '[&::-webkit-inner-spin-button]:appearance-none',
          '[&::-webkit-outer-spin-button]:appearance-none'
        )}
      />
      {suffix && (
        <span className="text-[10px] text-muted-foreground pr-1 select-none pointer-events-none">
          {suffix}
        </span>
      )}
      <StepperButton ariaLabel="증가" onClick={() => commit(value + step)}>
        <PlusIcon className="size-3" />
      </StepperButton>
    </div>
  )
}

function StepperButton({
  ariaLabel,
  onClick,
  children
}: {
  ariaLabel: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'h-full px-2 flex items-center justify-center text-muted-foreground',
        'hover:bg-accent hover:text-foreground transition-colors cursor-pointer',
        'first:rounded-l-md last:rounded-r-md'
      )}
    >
      {children}
    </button>
  )
}

/**
 * 크기 input — rem 고정 + NumberStepper.
 *
 * - value: CSS 문자열 ("1.875rem", "16px"). px 는 16 으로 나눠 rem 환산.
 * - onChange: "X.XXrem" 정규화 저장
 */
function SizeInput({
  value,
  onChange
}: {
  value: string
  onChange: (next: string) => void
}): React.JSX.Element {
  const parsed = parseSize(value)
  const remValue = parsed.unit === 'px' ? parsed.value / 16 : parsed.value

  return (
    <NumberStepper
      value={remValue}
      onChange={(next) => onChange(formatSize({ value: next, unit: 'rem' }))}
      step={SIZE_STEP}
      min={SIZE_MIN}
      max={SIZE_MAX}
      suffix="rem"
    />
  )
}

/**
 * 경계선 굵기 input — px 고정 + NumberStepper (정수 step).
 *
 * - value: CSS 문자열 ("3px"). rem 인 경우 *16 환산.
 * - onChange: "Xpx" 정규화 저장.
 */
function BorderWidthInput({
  value,
  onChange
}: {
  value: string
  onChange: (next: string) => void
}): React.JSX.Element {
  const parsed = parseSize(value)
  const pxValue = parsed.unit === 'rem' ? parsed.value * 16 : parsed.value

  return (
    <NumberStepper
      value={pxValue}
      onChange={(next) => onChange(formatSize({ value: Math.max(0, next), unit: 'px' }))}
      step={1}
      min={0}
      max={20}
      suffix="px"
    />
  )
}

/**
 * 색상 input — color picker + hex 입력 한 줄.
 */
function ColorInput({
  value,
  onChange
}: {
  value: string
  onChange: (next: string) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-12 p-1 cursor-pointer"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm font-mono"
      />
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
 * Lorem preview — 내부 light/dark 토글 + 강제 모드 색상.
 *
 * - Milkdown 에디터 read-only 모드로 실제 노트 렌더링과 100% 일치
 * - 앱 테마와 무관하게 사용자가 선택한 mode 색상을 표시 (편집 중인 색상 즉시 확인용)
 * - 배경/테두리는 global.css 의 `--background` / `--border` 토큰과 동일 값을 inline 으로 사용
 * - preview CSS 셀렉터는 [data-rally-note-preview] 2회 chain → global.css `.milkdown .ProseMirror`
 *   (0,2,1) 와 동률 + load order 로 승리
 */
function NoteStylePreview({ set }: { set: NoteStyleSettings }): React.JSX.Element {
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light')
  const css = buildNoteStyleCss(
    set,
    '[data-rally-note-preview][data-rally-note-preview]',
    previewMode
  )

  const previewBg = previewMode === 'dark' ? 'oklch(0.145 0 0)' : 'oklch(1 0 0)'
  const previewBorder = previewMode === 'dark' ? 'oklch(0.269 0 0)' : 'oklch(0.922 0 0)'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs text-muted-foreground">미리보기</Label>
        <div className="flex rounded-md border overflow-hidden">
          <PreviewModeButton
            active={previewMode === 'light'}
            onClick={() => setPreviewMode('light')}
          >
            라이트
          </PreviewModeButton>
          <PreviewModeButton active={previewMode === 'dark'} onClick={() => setPreviewMode('dark')}>
            다크
          </PreviewModeButton>
        </div>
      </div>
      <div
        data-rally-note-preview
        style={{ backgroundColor: previewBg, borderColor: previewBorder }}
        className="rounded-md border p-4 max-h-64 overflow-y-auto transition-colors"
      >
        <style>{css}</style>
        <MilkdownProvider>
          <PreviewMilkdownEditor />
        </MilkdownProvider>
      </div>
    </div>
  )
}

/**
 * Milkdown 에디터 (read-only). 정적 PREVIEW_MARKDOWN 을 렌더하며 편집 불가.
 * - commonmark + gfm 만 사용 (history / listener / upload 등 인터랙션 플러그인 제외)
 * - editorViewOptionsCtx.editable: () => false 로 편집 비활성
 */
function PreviewMilkdownEditor(): React.JSX.Element {
  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, PREVIEW_MARKDOWN)
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          editable: () => false
        }))
      })
      .use(commonmark)
      .use(gfm)
  )

  return <Milkdown />
}

function PreviewModeButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 px-2.5 text-[11px] font-medium transition-colors cursor-pointer',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-background text-muted-foreground hover:bg-accent'
      )}
    >
      {children}
    </button>
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
    // v1 / v2 모두 parseNoteStyleSettings 가 자동 처리
    const parsed = parseNoteStyleSettings(template.settingsJson)
    onApply(parsed)
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
            // IME 조합 중 Enter (한글 등) 는 무시 — 조합 종료용 Enter + 실제 submit Enter 가 모두 trigger 되는 중복 호출 방지
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
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

/**
 * 노트 toolbar 색상 팔레트 편집 UI.
 *
 * 노트 설정 탭 하단에 들어가는 섹션. 라이트/다크 모드 각각 8 슬롯의 hex
 * 색상을 사용자가 편집 가능. 기본값 초기화 (slot 별 또는 전체) 지원.
 */
import { useState } from 'react'
import { RotateCcwIcon } from 'lucide-react'
import {
  DEFAULT_TOOLBAR_PALETTE,
  PALETTE_SLOT_COUNT,
  useToolbarPalette,
  type PaletteColors,
  type ToolbarColorPalette
} from '@entities/note-toolbar-palette'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { cn } from '@/shared/lib/utils'

type PaletteMode = 'light' | 'dark'

function ColorSlotInput({
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

function ModeToggleButton({
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
      onClick={onClick}
      className={cn(
        'px-3 py-1 text-xs transition-colors cursor-pointer',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-background hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {children}
    </button>
  )
}

export function NoteToolbarPaletteSection(): React.JSX.Element {
  const { palette, isLoading, save, reset } = useToolbarPalette()
  const [mode, setMode] = useState<PaletteMode>('light')

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">불러오는 중…</div>
  }

  const updateSlot = (index: number, next: string): void => {
    const currentMode = palette[mode]
    const updated = [...currentMode] as string[]
    updated[index] = next
    const nextPalette: ToolbarColorPalette = {
      ...palette,
      [mode]: updated as unknown as PaletteColors
    }
    save(nextPalette)
  }

  const resetSlot = (index: number): void => {
    const defaults = DEFAULT_TOOLBAR_PALETTE[mode]
    updateSlot(index, defaults[index])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Toolbar 색상 팔레트</h3>
          <p className="text-xs text-muted-foreground">
            에디터 floating toolbar 에 표시되는 8개 색상. 라이트/다크 모드별로 따로 지정.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => reset()}
          className="h-8 gap-1.5"
          data-testid="palette-reset-all"
        >
          <RotateCcwIcon className="size-3" />
          초기화
        </Button>
      </div>

      {/* 모드 전환 */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">모드</Label>
        <div className="flex rounded-md border overflow-hidden">
          <ModeToggleButton active={mode === 'light'} onClick={() => setMode('light')}>
            라이트
          </ModeToggleButton>
          <ModeToggleButton active={mode === 'dark'} onClick={() => setMode('dark')}>
            다크
          </ModeToggleButton>
        </div>
      </div>

      {/* 8 슬롯 */}
      <div className="grid grid-cols-2 gap-3" data-testid="palette-slots">
        {Array.from({ length: PALETTE_SLOT_COUNT }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">슬롯 {i + 1}</Label>
              <button
                onClick={() => resetSlot(i)}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                data-testid={`palette-slot-reset-${i}`}
                aria-label={`슬롯 ${i + 1} 초기화`}
              >
                <RotateCcwIcon className="size-3" />
              </button>
            </div>
            <ColorSlotInput value={palette[mode][i]} onChange={(next) => updateSlot(i, next)} />
          </div>
        ))}
      </div>
    </div>
  )
}

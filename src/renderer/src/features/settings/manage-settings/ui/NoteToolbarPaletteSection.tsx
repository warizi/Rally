/**
 * 노트 toolbar 색상 팔레트 편집 UI.
 *
 * 노트 설정 탭 하단에 들어가는 섹션. 8 슬롯 단일 hex 색상 편집.
 * (다크 모드 매핑 / 라이트-다크 분리 없음 — 사용자가 양 모드에서 가독성 있는 색 선택)
 */
import { RotateCcwIcon } from 'lucide-react'
import {
  DEFAULT_TOOLBAR_PALETTE,
  PALETTE_SLOT_COUNT,
  useToolbarPalette,
  type ToolbarColorPalette
} from '@entities/note-toolbar-palette'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

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

export function NoteToolbarPaletteSection(): React.JSX.Element {
  const { palette, isLoading, save, reset } = useToolbarPalette()

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">불러오는 중…</div>
  }

  const updateSlot = (index: number, next: string): void => {
    const updated = [...palette] as string[]
    updated[index] = next
    save(updated as unknown as ToolbarColorPalette)
  }

  const resetSlot = (index: number): void => {
    updateSlot(index, DEFAULT_TOOLBAR_PALETTE[index])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Toolbar 색상 팔레트</h3>
          <p className="text-xs text-muted-foreground">
            에디터 floating toolbar 에 표시되는 8개 색상.
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
            <ColorSlotInput value={palette[i]} onChange={(next) => updateSlot(i, next)} />
          </div>
        ))}
      </div>
    </div>
  )
}

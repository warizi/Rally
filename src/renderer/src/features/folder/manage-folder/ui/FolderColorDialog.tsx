import { JSX, useState } from 'react'
import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'

const PRESET_COLORS: { label: string; value: string | null }[] = [
  { label: '기본', value: null },
  { label: '빨강', value: '#ffb3b3' },
  { label: '주황', value: '#ffd1a3' },
  { label: '노랑', value: '#fff0a3' },
  { label: '라임', value: '#d4f5a3' },
  { label: '초록', value: '#b3f0c2' },
  { label: '청록', value: '#a3e8e0' },
  { label: '파랑', value: '#a3c4f5' },
  { label: '남색', value: '#b3b3f5' },
  { label: '보라', value: '#d4b3f5' },
  { label: '분홍', value: '#ffb3d9' },
  { label: '갈색', value: '#e8ccb3' },
  { label: '회색', value: '#d1d5db' },
  { label: '흰색', value: '#f5f5f5' }
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentColor: string | null
  isPending?: boolean
  onSubmit: (color: string | null) => void
}

export function FolderColorDialog({
  open,
  onOpenChange,
  currentColor,
  isPending,
  onSubmit
}: Props): JSX.Element {
  const [selected, setSelected] = useState<string | null>(currentColor)

  const handleOpenChange = (nextOpen: boolean): void => {
    if (nextOpen) setSelected(currentColor)
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>폴더 색상</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-7 gap-x-1 gap-y-1.5 py-2">
          {PRESET_COLORS.map(({ label, value }) => (
            <button
              key={label}
              type="button"
              title={label}
              onClick={() => setSelected(value)}
              className="flex items-center justify-center"
            >
              <span
                className="size-9 rounded-lg flex items-center justify-center border-2 transition-all"
                style={{
                  backgroundColor: value ?? 'transparent',
                  borderColor: selected === value ? 'hsl(var(--foreground))' : 'transparent',
                  outline:
                    selected === value ? '2px solid hsl(var(--foreground) / 0.3)' : undefined,
                  outlineOffset: selected === value ? '2px' : undefined
                }}
              >
                {selected === value && (
                  <Check
                    className="size-4"
                    style={{ color: value ? '#888' : 'hsl(var(--foreground))' }}
                  />
                )}
                {value === null && selected !== null && (
                  <span className="text-muted-foreground text-xs">✕</span>
                )}
              </span>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={() => onSubmit(selected)} disabled={isPending}>
            {isPending ? '적용 중...' : '적용'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

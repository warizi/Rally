import { Check } from 'lucide-react'

const TAG_COLORS = [
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
  { label: '회색', value: '#d1d5db' }
]

interface Props {
  value: string
  onChange: (color: string) => void
}

export function TagColorPicker({ value, onChange }: Props): React.JSX.Element {
  return (
    <div className="grid grid-cols-6 gap-1 py-1">
      {TAG_COLORS.map(({ label, value: color }) => (
        <button
          key={label}
          type="button"
          title={label}
          onClick={() => onChange(color)}
          className="flex items-center justify-center"
        >
          <span
            className="size-7 rounded-md flex items-center justify-center border-2 transition-all"
            style={{
              backgroundColor: color,
              borderColor: value === color ? 'hsl(var(--foreground))' : 'transparent'
            }}
          >
            {value === color && <Check className="size-3.5" style={{ color: '#fff' }} />}
          </span>
        </button>
      ))}
    </div>
  )
}

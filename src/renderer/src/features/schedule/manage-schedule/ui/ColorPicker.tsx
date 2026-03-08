import { Check } from 'lucide-react'
import { SCHEDULE_COLOR_PRESETS } from '../model/schedule-color'

interface Props {
  value: string | null
  onChange: (color: string | null) => void
}

export function ColorPicker({ value, onChange }: Props): React.JSX.Element {
  return (
    <div className="grid grid-cols-8 gap-1 py-1">
      {SCHEDULE_COLOR_PRESETS.map(({ label, value: color }) => (
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
              backgroundColor: color ?? 'transparent',
              borderColor: value === color ? 'hsl(var(--foreground))' : 'transparent'
            }}
          >
            {value === color && (
              <Check
                className="size-3.5"
                style={{ color: color ? '#fff' : 'hsl(var(--foreground))' }}
              />
            )}
            {color === null && value !== null && (
              <span className="text-muted-foreground text-xs">✕</span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}

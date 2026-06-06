import { Progress } from '@shared/ui/progress'

interface Props {
  label: string
  value: number
}

export function ProgressToast({ label, value }: Props): React.JSX.Element {
  return (
    <div className="flex w-full min-w-[260px] flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">{value}%</span>
      </div>
      <Progress value={value} />
    </div>
  )
}

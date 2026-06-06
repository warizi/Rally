interface Props {
  value: number
}

/**
 * 토스트 description 영역에 들어가는 얇고 우아한 진행바.
 * - 토스트 전체 폭을 채워 우측 여백 제거 (w-full + flex-1 min-w-0)
 * - width transition 으로 부드럽게 차오름
 */
export function ProgressBar({ value }: Props): React.JSX.Element {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="mt-1.5 flex w-full items-center gap-2">
      <div className="bg-muted/70 h-1 min-w-0 flex-1 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="text-muted-foreground shrink-0 text-right text-[11px] tabular-nums">
        {v}%
      </span>
    </div>
  )
}

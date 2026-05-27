/**
 * 키보드 조작 모드 공용 오버레이 — 풀스크린 블러 배경 + 카드 리스트.
 *
 * 사용처:
 * - 탭 이동 오버레이 (shift+tab)
 * - 탭 스냅샷 전환 오버레이 (cmd+shift+t)
 *
 * 컨트롤 입력 자체는 부모 hook 이 담당. 이 컴포넌트는 표시 + focusIndex
 * 하이라이트만 책임.
 */
import { JSX, ReactNode } from 'react'
import { Check } from 'lucide-react'

export interface OverlayPickerItem {
  id: string
  label: string
  icon?: ReactNode
  meta?: ReactNode
}

interface Props {
  items: OverlayPickerItem[]
  focusIndex: number
  title?: string
  /** 풋터 영역 — 키 조합 안내 문구 등. */
  footer?: ReactNode
}

export function KeyboardOverlayPicker({
  items,
  focusIndex,
  title,
  footer
}: Props): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 backdrop-blur-sm bg-background/60 pointer-events-none"
      data-testid="keyboard-overlay-picker"
    >
      {title && (
        <div className="text-sm font-medium text-foreground/80 tracking-wide">{title}</div>
      )}
      <div className="flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto px-2">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground italic px-3 py-1.5">항목 없음</div>
        ) : (
          items.map((item, i) => {
            const focus = i === focusIndex
            return (
              <div
                key={item.id}
                className={
                  'flex items-center gap-2 min-w-[280px] max-w-[480px] rounded-md border px-3 py-2 text-sm transition-colors ' +
                  (focus
                    ? 'border-primary bg-primary/10 text-foreground shadow-md ring-2 ring-primary/40'
                    : 'border-border/40 bg-card/70 text-foreground/80')
                }
              >
                {item.icon && <span className="shrink-0 size-4 flex items-center">{item.icon}</span>}
                <span className="truncate flex-1">{item.label}</span>
                {item.meta && <span className="text-xs text-muted-foreground shrink-0">{item.meta}</span>}
                {focus && <Check className="size-3.5 text-primary shrink-0" />}
              </div>
            )
          })
        )}
      </div>
      {footer && (
        <div className="text-[11px] text-muted-foreground tracking-wide">{footer}</div>
      )}
    </div>
  )
}

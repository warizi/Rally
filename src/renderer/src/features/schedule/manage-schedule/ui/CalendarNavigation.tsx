import { Button } from '@shared/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  title: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function CalendarNavigation({ title, onPrev, onNext, onToday }: Props): React.JSX.Element {
  return (
    <div className="flex flex-col @[400px]:flex-row @[400px]:items-center gap-1 px-1">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={onToday}>
          오늘
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onPrev}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onNext}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <span className="text-base font-semibold @[400px]:ml-2">{title}</span>
    </div>
  )
}

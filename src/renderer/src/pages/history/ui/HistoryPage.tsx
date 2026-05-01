import { JSX, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Clock } from 'lucide-react'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { Input } from '@shared/ui/input'
import { Button } from '@shared/ui/button'
import { DatePickerButton } from '@shared/ui/date-picker-button'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { HistoryTimeline } from '@/widgets/history-timeline'

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebounced(value), delay)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, delay])

  return debounced
}

function toDateKey(d: Date | null): string | null {
  if (!d) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function HistoryPage(): JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [fromDate, setFromDate] = useState<Date | null>(null)
  const [toDate, setToDate] = useState<Date | null>(null)

  const fromKey = useMemo(() => toDateKey(fromDate), [fromDate])
  const toKey = useMemo(() => toDateKey(toDate), [toDate])

  const hasFilter = !!query || !!fromDate || !!toDate

  const handleClearAll = (): void => {
    setQuery('')
    setFromDate(null)
    setToDate(null)
  }

  if (!workspaceId) {
    return (
      <TabContainer header={<TabHeader title="히스토리" icon={Clock} />}>
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          워크스페이스를 선택해주세요
        </div>
      </TabContainer>
    )
  }

  return (
    <TabContainer
      maxWidth={1200}
      scrollable={false}
      header={
        <div className="flex flex-col gap-3 pb-3">
          <TabHeader
            title="히스토리"
            description="완료한 할 일과 연결된 파일을 시간순으로 확인합니다."
            icon={Clock}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-56">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="할 일/파일 제목 검색..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <DatePickerButton
              value={fromDate}
              onChange={setFromDate}
              placeholder="시작 날짜"
            />
            <span className="text-muted-foreground text-xs">~</span>
            <DatePickerButton value={toDate} onChange={setToDate} placeholder="종료 날짜" />
            {hasFilter && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleClearAll}>
                <X className="size-3.5 mr-1" />
                초기화
              </Button>
            )}
          </div>
        </div>
      }
    >
      <HistoryTimeline
        workspaceId={workspaceId}
        query={debouncedQuery}
        fromDate={fromKey}
        toDate={toKey}
      />
    </TabContainer>
  )
}

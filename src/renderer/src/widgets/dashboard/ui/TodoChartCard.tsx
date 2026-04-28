import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { format, subDays, subMonths, startOfDay, isBefore, addDays } from 'date-fns'
import { useCountUp } from '@shared/hooks/use-count-up'
import { ko } from 'date-fns/locale'
import { useTodosByWorkspace } from '@entities/todo'
import { DashboardCard } from '@shared/ui/dashboard-card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from '@shared/ui/chart'

type RangeKey = '7d' | '30d' | '3m'

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
  { key: '3m', label: '3개월' }
]

const chartConfig = {
  created: {
    label: '생성',
    theme: {
      light: 'hsl(25 95% 55%)',
      dark: 'hsl(25 90% 60%)'
    }
  },
  completed: {
    label: '완료',
    theme: {
      light: 'hsl(220 70% 55%)',
      dark: 'hsl(220 70% 65%)'
    }
  }
} satisfies ChartConfig

interface Props {
  workspaceId: string
  className?: string
}

export function TodoChartCard({ workspaceId, className }: Props): React.JSX.Element {
  const [range, setRange] = useState<RangeKey>('7d')
  const { data: todos = [], isLoading } = useTodosByWorkspace(workspaceId, { filter: 'all' })

  const chartData = useMemo(() => {
    const now = new Date()
    const rangeStart =
      range === '7d' ? subDays(now, 6) : range === '30d' ? subDays(now, 29) : subMonths(now, 3)

    const start = startOfDay(rangeStart)
    const end = startOfDay(addDays(now, 1))

    // Build date buckets
    const buckets = new Map<string, { created: number; completed: number }>()
    let cursor = start
    while (isBefore(cursor, end)) {
      buckets.set(format(cursor, 'yyyy-MM-dd'), { created: 0, completed: 0 })
      cursor = addDays(cursor, 1)
    }

    // Fill buckets
    for (const todo of todos) {
      const createdKey = format(startOfDay(todo.createdAt), 'yyyy-MM-dd')
      if (buckets.has(createdKey)) {
        buckets.get(createdKey)!.created++
      }

      if (todo.doneAt) {
        const doneKey = format(startOfDay(todo.doneAt), 'yyyy-MM-dd')
        if (buckets.has(doneKey)) {
          buckets.get(doneKey)!.completed++
        }
      }
    }

    return Array.from(buckets.entries()).map(([date, counts]) => ({
      date,
      ...counts
    }))
  }, [todos, range])

  const tickFormatter = (value: string): string => {
    const d = new Date(value)
    if (range === '3m') return format(d, 'M/d')
    return format(d, 'M/d (eee)', { locale: ko })
  }

  const totalCreated = chartData.reduce((s, d) => s + d.created, 0)
  const totalCompleted = chartData.reduce((s, d) => s + d.completed, 0)

  return (
    <DashboardCard
      title="할 일 추이"
      icon={TrendingUp}
      className={className}
      isLoading={isLoading}
      action={
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                range === r.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            생성 <strong className="text-foreground">{useCountUp(totalCreated)}</strong>
          </span>
          <span>
            완료 <strong className="text-foreground">{useCountUp(totalCompleted)}</strong>
          </span>
        </div>

        <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
          <AreaChart data={chartData} margin={{ top: 4, right: 20, bottom: 0, left: 20 }}>
            <defs>
              <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-created)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-created)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-completed)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-completed)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={tickFormatter}
              interval={range === '7d' ? 0 : range === '30d' ? 6 : 'preserveStartEnd'}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    format(new Date(value as string), 'yyyy년 M월 d일 (eee)', { locale: ko })
                  }
                />
              }
            />
            <Area
              dataKey="completed"
              type="monotone"
              fill="url(#fillCompleted)"
              stroke="var(--color-completed)"
              stackId="a"
            />
            <Area
              dataKey="created"
              type="monotone"
              fill="url(#fillCreated)"
              stroke="var(--color-created)"
              stackId="a"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </div>
    </DashboardCard>
  )
}

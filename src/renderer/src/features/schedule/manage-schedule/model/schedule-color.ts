import type { ScheduleItem } from '@entities/schedule'

export const SCHEDULE_COLOR_PRESETS = [
  { label: '기본', value: null },
  { label: '빨강', value: '#ef4444' },
  { label: '주황', value: '#f97316' },
  { label: '노랑', value: '#eab308' },
  { label: '초록', value: '#22c55e' },
  { label: '파랑', value: '#3b82f6' },
  { label: '보라', value: '#a855f7' },
  { label: '분홍', value: '#ec4899' },
] as const

export const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#3b82f6',
  low: '#6b7280',
}

export function getScheduleColor(schedule: ScheduleItem): string {
  return schedule.color ?? PRIORITY_COLORS[schedule.priority]
}

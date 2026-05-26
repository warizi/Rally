import { useQuery, useQueryClient } from '@tanstack/react-query'

const SETTINGS_KEY = 'toastSettings'
const DURATION_DB_KEY = 'toast.duration'
const VISIBLE_COUNT_DB_KEY = 'toast.visibleCount'

export const DEFAULT_TOAST_DURATION = 4000
export const DEFAULT_TOAST_VISIBLE_COUNT = 3

/** Infinity 는 String(Infinity) === 'Infinity' 로 직렬화 — 자동 닫힘 끔 */
const INFINITY_TOKEN = 'Infinity'

export const TOAST_DURATION_OPTIONS = [
  { value: 3000, label: '3초' },
  { value: 5000, label: '5초' },
  { value: 10000, label: '10초' },
  { value: Number.POSITIVE_INFINITY, label: '자동 닫힘 안 함' }
] as const

export const TOAST_VISIBLE_COUNT_OPTIONS = [
  { value: 3, label: '3개' },
  { value: 5, label: '5개' },
  { value: 10, label: '10개' }
] as const

function parseDuration(raw: string | null | undefined): number {
  if (raw == null) return DEFAULT_TOAST_DURATION
  if (raw === INFINITY_TOKEN) return Number.POSITIVE_INFINITY
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TOAST_DURATION
}

function serializeDuration(value: number): string {
  if (!Number.isFinite(value)) return INFINITY_TOKEN
  return String(value)
}

function parseVisibleCount(raw: string | null | undefined): number {
  if (raw == null) return DEFAULT_TOAST_VISIBLE_COUNT
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_TOAST_VISIBLE_COUNT
}

interface ToastSettings {
  duration: number
  visibleCount: number
}

/**
 * 토스트 채류 시간 + 동시 표시 개수 설정.
 * App.tsx 의 Toaster props 에 주입되어 전역 적용.
 */
export function useToastSettings(): ToastSettings & {
  setDuration: (value: number) => Promise<void>
  setVisibleCount: (value: number) => Promise<void>
} {
  const queryClient = useQueryClient()

  const { data } = useQuery<ToastSettings>({
    queryKey: [SETTINGS_KEY],
    queryFn: async (): Promise<ToastSettings> => {
      const [durationRes, visibleRes] = await Promise.all([
        window.api.settings.get(DURATION_DB_KEY),
        window.api.settings.get(VISIBLE_COUNT_DB_KEY)
      ])
      return {
        duration: parseDuration(durationRes.success ? (durationRes.data as string) : null),
        visibleCount: parseVisibleCount(visibleRes.success ? (visibleRes.data as string) : null)
      }
    }
  })

  const duration = data?.duration ?? DEFAULT_TOAST_DURATION
  const visibleCount = data?.visibleCount ?? DEFAULT_TOAST_VISIBLE_COUNT

  async function setDuration(value: number): Promise<void> {
    await window.api.settings.set(DURATION_DB_KEY, serializeDuration(value))
    queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] })
  }

  async function setVisibleCount(value: number): Promise<void> {
    await window.api.settings.set(VISIBLE_COUNT_DB_KEY, String(value))
    queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] })
  }

  return { duration, visibleCount, setDuration, setVisibleCount }
}

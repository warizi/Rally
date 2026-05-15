/**
 * 노트 toolbar 색상 팔레트 load / save.
 *
 * - 미존재 → DEFAULT
 * - 손상된 JSON → DEFAULT fallback
 * - 부분 데이터 → DEFAULT 와 merge (슬롯 단위)
 * - v1 (light/dark 분리) 형식 자동 마이그레이션 → v2 (단일 배열)
 *   - light 배열을 새 단일 배열로 채택, dark 는 폐기
 * - save 는 setQueryData 로 낙관적 갱신
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_TOOLBAR_PALETTE } from './defaults'
import { NOTE_TOOLBAR_PALETTE_KEY, PALETTE_SLOT_COUNT, type ToolbarColorPalette } from './types'

const QUERY_KEY = ['note-toolbar-palette']

function mergeArray(partial: unknown, defaults: ToolbarColorPalette): ToolbarColorPalette {
  if (!Array.isArray(partial)) return defaults
  const result = [...defaults] as string[]
  for (let i = 0; i < PALETTE_SLOT_COUNT; i++) {
    const v = partial[i]
    if (typeof v === 'string' && v.length > 0) result[i] = v
  }
  return result as unknown as ToolbarColorPalette
}

interface V1Shape {
  light?: unknown
  dark?: unknown
}

function isV1(parsed: unknown): parsed is V1Shape {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    ('light' in parsed || 'dark' in parsed)
  )
}

export function parseToolbarPalette(raw: string | null | undefined): ToolbarColorPalette {
  if (!raw) return DEFAULT_TOOLBAR_PALETTE
  try {
    const parsed = JSON.parse(raw) as unknown
    // v1 → v2 마이그레이션: light 배열을 새 단일 배열로
    if (isV1(parsed)) {
      const source = Array.isArray(parsed.light) ? parsed.light : parsed.dark
      return mergeArray(source, DEFAULT_TOOLBAR_PALETTE)
    }
    if (Array.isArray(parsed)) {
      return mergeArray(parsed, DEFAULT_TOOLBAR_PALETTE)
    }
    return DEFAULT_TOOLBAR_PALETTE
  } catch {
    return DEFAULT_TOOLBAR_PALETTE
  }
}

export function useToolbarPalette(): {
  palette: ToolbarColorPalette
  isLoading: boolean
  save: (next: ToolbarColorPalette) => void
  reset: () => void
} {
  const qc = useQueryClient()

  const query = useQuery<ToolbarColorPalette>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await window.api.settings.get(NOTE_TOOLBAR_PALETTE_KEY)
      if (!res.success) return DEFAULT_TOOLBAR_PALETTE
      return parseToolbarPalette(res.data as string | null)
    },
    staleTime: Infinity
  })

  const mutation = useMutation({
    mutationFn: async (next: ToolbarColorPalette) => {
      await window.api.settings.set(NOTE_TOOLBAR_PALETTE_KEY, JSON.stringify(next))
      return next
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY })
      const prev = qc.getQueryData<ToolbarColorPalette>(QUERY_KEY)
      qc.setQueryData(QUERY_KEY, next)
      return { prev }
    },
    onError: (_e, _next, context) => {
      if (context?.prev) qc.setQueryData(QUERY_KEY, context.prev)
    }
  })

  return {
    palette: query.data ?? DEFAULT_TOOLBAR_PALETTE,
    isLoading: query.isLoading,
    save: (next) => mutation.mutate(next),
    reset: () => mutation.mutate(DEFAULT_TOOLBAR_PALETTE)
  }
}

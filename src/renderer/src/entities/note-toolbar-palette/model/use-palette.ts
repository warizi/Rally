/**
 * 노트 toolbar 색상 팔레트 load / save.
 *
 * - 미존재 → DEFAULT
 * - 손상된 JSON → DEFAULT fallback
 * - 부분 데이터 → DEFAULT 와 merge (light / dark 각각 슬롯 단위)
 * - save 는 setQueryData 로 낙관적 갱신
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_TOOLBAR_PALETTE } from './defaults'
import {
  NOTE_TOOLBAR_PALETTE_KEY,
  PALETTE_SLOT_COUNT,
  type PaletteColors,
  type ToolbarColorPalette
} from './types'

const QUERY_KEY = ['note-toolbar-palette']

function mergeMode(partial: unknown, defaults: PaletteColors): PaletteColors {
  if (!Array.isArray(partial)) return defaults
  const result = [...defaults] as string[]
  for (let i = 0; i < PALETTE_SLOT_COUNT; i++) {
    const v = partial[i]
    if (typeof v === 'string' && v.length > 0) result[i] = v
  }
  return result as unknown as PaletteColors
}

export function parseToolbarPalette(raw: string | null | undefined): ToolbarColorPalette {
  if (!raw) return DEFAULT_TOOLBAR_PALETTE
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return DEFAULT_TOOLBAR_PALETTE
    const obj = parsed as { light?: unknown; dark?: unknown }
    return {
      light: mergeMode(obj.light, DEFAULT_TOOLBAR_PALETTE.light),
      dark: mergeMode(obj.dark, DEFAULT_TOOLBAR_PALETTE.dark)
    }
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

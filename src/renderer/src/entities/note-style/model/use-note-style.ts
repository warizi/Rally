/**
 * 노트 스타일 설정을 app-settings (JSON 컬럼) 에서 load / save.
 *
 * - 미존재 시 DEFAULT 반환
 * - 손상된 JSON 도 DEFAULT 로 fallback
 * - save 는 setQueryData 로 낙관적 갱신 (즉시 적용)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_NOTE_STYLE_SETTINGS } from './defaults'
import {
  NOTE_STYLE_SETTINGS_KEY,
  type NoteStyleSettings,
  type NoteStyleSet,
  type ThemeMode
} from './types'

const QUERY_KEY = ['note-style']

function parseSettings(raw: string | null | undefined): NoteStyleSettings {
  if (!raw) return DEFAULT_NOTE_STYLE_SETTINGS
  try {
    const parsed = JSON.parse(raw) as Partial<NoteStyleSettings>
    return {
      light: { ...DEFAULT_NOTE_STYLE_SETTINGS.light, ...(parsed.light ?? {}) },
      dark: { ...DEFAULT_NOTE_STYLE_SETTINGS.dark, ...(parsed.dark ?? {}) }
    }
  } catch {
    return DEFAULT_NOTE_STYLE_SETTINGS
  }
}

export function useNoteStyle(): {
  settings: NoteStyleSettings
  isLoading: boolean
  save: (next: NoteStyleSettings) => void
  saveMode: (mode: ThemeMode, set: NoteStyleSet) => void
  resetMode: (mode: ThemeMode) => void
} {
  const qc = useQueryClient()

  const query = useQuery<NoteStyleSettings>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await window.api.settings.get(NOTE_STYLE_SETTINGS_KEY)
      if (!res.success) return DEFAULT_NOTE_STYLE_SETTINGS
      return parseSettings(res.data as string | null)
    },
    staleTime: Infinity
  })

  const mutation = useMutation({
    mutationFn: async (next: NoteStyleSettings) => {
      await window.api.settings.set(NOTE_STYLE_SETTINGS_KEY, JSON.stringify(next))
      return next
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY })
      const prev = qc.getQueryData<NoteStyleSettings>(QUERY_KEY)
      qc.setQueryData(QUERY_KEY, next)
      return { prev }
    },
    onError: (_e, _next, context) => {
      if (context?.prev) qc.setQueryData(QUERY_KEY, context.prev)
    }
  })

  const settings = query.data ?? DEFAULT_NOTE_STYLE_SETTINGS

  return {
    settings,
    isLoading: query.isLoading,
    save: (next) => mutation.mutate(next),
    saveMode: (mode, set) => mutation.mutate({ ...settings, [mode]: set }),
    resetMode: (mode) => mutation.mutate({ ...settings, [mode]: DEFAULT_NOTE_STYLE_SETTINGS[mode] })
  }
}

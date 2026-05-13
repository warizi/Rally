/**
 * 노트 스타일 설정을 app-settings (JSON 컬럼) 에서 load / save.
 *
 * - 미존재 → DEFAULT
 * - 손상된 JSON → DEFAULT fallback
 * - v1 (light/dark 분리) 형식 자동 마이그레이션 → v2 (flat + colorLight/colorDark)
 * - save 는 setQueryData 로 낙관적 갱신
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_NOTE_STYLE_SETTINGS } from './defaults'
import {
  NOTE_STYLE_SETTINGS_KEY,
  STYLE_ELEMENT_KEYS,
  type ElementStyle,
  type NoteStyleSettings,
  type StyleElementKey
} from './types'

const QUERY_KEY = ['note-style']

interface V1ElementStyle {
  fontSize?: string
  lineHeight?: number
  marginTop?: string
  marginBottom?: string
  color?: string
}
interface V1Settings {
  light?: Partial<Record<StyleElementKey, V1ElementStyle>>
  dark?: Partial<Record<StyleElementKey, V1ElementStyle>>
}

function isV1(parsed: unknown): parsed is V1Settings {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'light' in parsed &&
    'dark' in parsed &&
    typeof (parsed as V1Settings).light === 'object' &&
    typeof (parsed as V1Settings).dark === 'object'
  )
}

/** v1 → v2 변환. 비-색상 속성은 light 쪽 값 우선. 신규 bg 필드는 defaults 사용. */
function migrateFromV1(v1: V1Settings): NoteStyleSettings {
  const result = {} as NoteStyleSettings
  for (const key of STYLE_ELEMENT_KEYS) {
    const l = v1.light?.[key] ?? {}
    const d = v1.dark?.[key] ?? {}
    const def = DEFAULT_NOTE_STYLE_SETTINGS[key]
    result[key] = {
      fontSize: l.fontSize ?? def.fontSize,
      lineHeight: l.lineHeight ?? def.lineHeight,
      marginTop: l.marginTop ?? def.marginTop,
      marginBottom: l.marginBottom ?? def.marginBottom,
      colorLight: l.color ?? def.colorLight,
      colorDark: d.color ?? def.colorDark,
      backgroundLight: def.backgroundLight,
      backgroundDark: def.backgroundDark,
      borderColorLight: def.borderColorLight,
      borderColorDark: def.borderColorDark,
      borderWidth: def.borderWidth
    }
  }
  return result
}

function mergeWithDefaults(partial: Partial<NoteStyleSettings>): NoteStyleSettings {
  const result = {} as NoteStyleSettings
  for (const key of STYLE_ELEMENT_KEYS) {
    const fromPartial = partial[key] as Partial<ElementStyle> | undefined
    result[key] = { ...DEFAULT_NOTE_STYLE_SETTINGS[key], ...(fromPartial ?? {}) }
  }
  return result
}

export function parseNoteStyleSettings(raw: string | null | undefined): NoteStyleSettings {
  if (!raw) return DEFAULT_NOTE_STYLE_SETTINGS
  try {
    const parsed = JSON.parse(raw) as unknown
    if (isV1(parsed)) {
      return migrateFromV1(parsed)
    }
    if (parsed && typeof parsed === 'object') {
      return mergeWithDefaults(parsed as Partial<NoteStyleSettings>)
    }
    return DEFAULT_NOTE_STYLE_SETTINGS
  } catch {
    return DEFAULT_NOTE_STYLE_SETTINGS
  }
}

export function useNoteStyle(): {
  settings: NoteStyleSettings
  isLoading: boolean
  save: (next: NoteStyleSettings) => void
  reset: () => void
} {
  const qc = useQueryClient()

  const query = useQuery<NoteStyleSettings>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await window.api.settings.get(NOTE_STYLE_SETTINGS_KEY)
      if (!res.success) return DEFAULT_NOTE_STYLE_SETTINGS
      return parseNoteStyleSettings(res.data as string | null)
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

  return {
    settings: query.data ?? DEFAULT_NOTE_STYLE_SETTINGS,
    isLoading: query.isLoading,
    save: (next) => mutation.mutate(next),
    reset: () => mutation.mutate(DEFAULT_NOTE_STYLE_SETTINGS)
  }
}

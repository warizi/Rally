import { useQuery, useQueryClient } from '@tanstack/react-query'

const SETTINGS_KEY = 'noteSyntaxHint'
const DB_KEY = 'note.syntaxHint'

/**
 * 노트 편집 시 커서가 위치한 블록에 마크다운 문법 힌트(#, --- 등)를 표시할지 설정.
 * default: true (표시)
 *
 * off 면 NoteEditor 래퍼에 `.rally-syntax-hint-off` 클래스가 붙어 CSS 로 `.syntax-hint` 숨김.
 */
export function useSyntaxHintSetting(): {
  show: boolean
  setShow: (value: boolean) => Promise<void>
} {
  const queryClient = useQueryClient()

  const { data: show = true } = useQuery({
    queryKey: [SETTINGS_KEY],
    queryFn: async (): Promise<boolean> => {
      const res = await window.api.settings.get(DB_KEY)
      if (!res.success || res.data == null) return true
      return res.data !== 'false'
    }
  })

  async function setShow(value: boolean): Promise<void> {
    await window.api.settings.set(DB_KEY, String(value))
    queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] })
  }

  return { show, setShow }
}

import { useQuery, useQueryClient } from '@tanstack/react-query'

const SETTINGS_KEY = 'noteSpellcheck'
const DB_KEY = 'note.spellcheck'

/**
 * 노트 편집 시 맞춤법 검사(빨간 밑줄, spellcheck) 표시 여부 설정.
 * default: true (검사 표시 — 브라우저 기본 동작)
 *
 * NoteEditor 가 ProseMirror contenteditable 의 spellcheck 속성에 반영.
 */
export function useSpellcheckSetting(): {
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

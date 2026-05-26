import { useQuery, useQueryClient } from '@tanstack/react-query'

const SETTINGS_KEY = 'authorBadgeShow'
const DB_KEY = 'authorBadge.show'

/**
 * 작성자/수정자 뱃지 전역 표시 여부 설정.
 * default: true (보임)
 *
 * AuthorBadge / AuthorBadgePair 내부에서 호출 → false 면 null 반환.
 */
export function useShowAuthorBadgeSetting(): {
  show: boolean
  setShow: (value: boolean) => Promise<void>
} {
  const queryClient = useQueryClient()

  const { data: show = true } = useQuery({
    queryKey: [SETTINGS_KEY],
    queryFn: async (): Promise<boolean> => {
      const res = await window.api.settings.get(DB_KEY)
      // 저장값 없음(undefined/null) → default true
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

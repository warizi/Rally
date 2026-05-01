import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ENTITY_LINK_KEY } from './queries'

export function useEntityLinkWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.entityLink.onChanged(() => {
      queryClient.invalidateQueries({ queryKey: [ENTITY_LINK_KEY] })
      // 링크 변경은 히스토리(완료 todo의 연결 파일 표시)에도 영향
      queryClient.invalidateQueries({ queryKey: ['history'] })
    })
    return () => unsub()
  }, [queryClient])
}

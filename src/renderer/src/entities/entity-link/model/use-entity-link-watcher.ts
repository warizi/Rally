import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ENTITY_LINK_KEY } from './queries'

export function useEntityLinkWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.entityLink.onChanged(() => {
      queryClient.invalidateQueries({ queryKey: [ENTITY_LINK_KEY] })
    })
    return () => unsub()
  }, [queryClient])
}

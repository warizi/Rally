import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { SearchHit, SearchMode, SearchType } from '../model/types'

const SEARCH_KEY = 'entity-search'

interface SearchResultData {
  results: SearchHit[]
}

/**
 * 하이브리드(벡터+FTS) 통합 검색. window.api.search.query → searchService.search.
 * searchType이 없으면(벡터 미지원 도메인) 비활성화 — 호출부에서 클라이언트 필터로 폴백.
 */
export function useEntitySearch(
  workspaceId: string | null | undefined,
  query: string,
  searchType: SearchType | undefined,
  mode: SearchMode = 'hybrid'
): UseQueryResult<SearchHit[]> {
  const trimmed = query.trim()
  return useQuery({
    queryKey: [SEARCH_KEY, workspaceId, searchType, mode, trimmed],
    enabled: !!workspaceId && !!trimmed && !!searchType,
    queryFn: async (): Promise<SearchHit[]> => {
      const res: IpcResponse<SearchResultData> = await window.api.search.query(
        workspaceId!,
        trimmed,
        { types: [searchType!], mode, limit: 50 }
      )
      if (!res.success) throwIpcError(res)
      return res.data?.results ?? []
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData
  })
}

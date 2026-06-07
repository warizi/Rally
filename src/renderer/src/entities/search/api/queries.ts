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

// ── 전체 검색 (일치 + 유사 그룹) ──────────────────────────────
/** 키워드(일치) 대상 — pdf/image 포함 6도메인. */
const GLOBAL_KEYWORD_TYPES: SearchType[] = ['note', 'table', 'canvas', 'todo', 'pdf', 'image']
/** 시맨틱(유사) 대상 — 임베딩 도메인만 (pdf/image 제외). */
const GLOBAL_SEMANTIC_TYPES: SearchType[] = ['note', 'table', 'canvas', 'todo']
const GLOBAL_EXACT_LIMIT = 10
const GLOBAL_SIMILAR_LIMIT = 10

export interface GlobalSearchResult {
  /** 검색어 포함(키워드) 결과 */
  exact: SearchHit[]
  /** 의미 유사(벡터) 결과 — 일치 그룹과 중복 제거됨 */
  similar: SearchHit[]
}

/**
 * 전체 검색 — keyword(6도메인)·semantic(임베딩 4도메인) 2회 호출로 일치/유사 그룹 분리.
 * 유사 그룹은 일치 그룹(type+id)과 중복 제거. 상한 일치 50 / 유사 20.
 */
export function useGlobalSearch(
  workspaceId: string | null | undefined,
  query: string
): UseQueryResult<GlobalSearchResult> {
  const trimmed = query.trim()
  return useQuery({
    queryKey: [SEARCH_KEY, 'global', workspaceId, trimmed],
    enabled: !!workspaceId && !!trimmed,
    queryFn: async (): Promise<GlobalSearchResult> => {
      const [kw, sem]: [IpcResponse<SearchResultData>, IpcResponse<SearchResultData>] =
        await Promise.all([
          window.api.search.query(workspaceId!, trimmed, {
            types: GLOBAL_KEYWORD_TYPES,
            mode: 'keyword',
            limit: 100,
            highlight: true
          }),
          window.api.search.query(workspaceId!, trimmed, {
            types: GLOBAL_SEMANTIC_TYPES,
            mode: 'semantic',
            limit: 100,
            highlight: true
          })
        ])
      if (!kw.success) throwIpcError(kw)
      if (!sem.success) throwIpcError(sem)

      const kwResults = kw.data?.results ?? []
      const exactKeys = new Set(kwResults.map((h) => `${h.type}:${h.id}`))
      const exact = kwResults.slice(0, GLOBAL_EXACT_LIMIT)
      const similar = (sem.data?.results ?? [])
        .filter((h) => !exactKeys.has(`${h.type}:${h.id}`))
        .slice(0, GLOBAL_SIMILAR_LIMIT)
      return { exact, similar }
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData
  })
}

/**
 * 여러 도메인 동시 하이브리드/시맨틱 검색 (예: 임베드 피커의 note/csv/canvas 통합).
 * types 가 비면 비활성.
 */
export function useEntitySearchMulti(
  workspaceId: string | null | undefined,
  query: string,
  types: SearchType[],
  mode: SearchMode = 'hybrid'
): UseQueryResult<SearchHit[]> {
  const trimmed = query.trim()
  return useQuery({
    queryKey: [SEARCH_KEY, 'multi', workspaceId, types, mode, trimmed],
    enabled: !!workspaceId && !!trimmed && types.length > 0,
    queryFn: async (): Promise<SearchHit[]> => {
      const res: IpcResponse<SearchResultData> = await window.api.search.query(
        workspaceId!,
        trimmed,
        { types, mode, limit: 50 }
      )
      if (!res.success) throwIpcError(res)
      return res.data?.results ?? []
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData
  })
}

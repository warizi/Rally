import { useMemo } from 'react'
import { useDebouncedValue } from '@shared/hooks/use-debounced-value'
import { useEntitySearch, type SearchType } from '@entities/search'
import type { LinkableEntityType } from '@shared/lib/entity-link'

export interface EntityOption {
  type: LinkableEntityType
  id: string
  title: string
}

export interface LinkSearchResult {
  /** 일반/벡터 그룹을 나눠 보여줄지 여부 (검색어 있음 + 벡터 지원 도메인) */
  grouped: boolean
  /** 일반 검색 — 제목 키워드 매칭 */
  keyword: EntityOption[]
  /** 벡터 검색 — 의미 유사 (키워드 결과에 없는 것만) */
  semantic: EntityOption[]
  /** 벡터 검색 진행 중 */
  semanticLoading: boolean
  /** 키보드 내비게이션용 평면 목록 (keyword 다음 semantic 순) */
  flat: EntityOption[]
}

// 벡터/FTS 검색 지원 도메인만 매핑 (table === csv). 나머지(schedule/pdf/image)는
// 임베딩 대상이 아니라 일반(제목) 검색만.
const TO_SEARCH_TYPE: Partial<Record<LinkableEntityType, SearchType>> = {
  note: 'note',
  csv: 'table',
  canvas: 'canvas',
  todo: 'todo'
}

/**
 * 링크 팝업의 도메인별 검색을 "일반(제목 키워드)" + "벡터(의미)" 두 그룹으로 분리해 반환.
 * - 일반: 제목 substring 매칭 (즉시).
 * - 벡터: 의미 검색(mode='semantic') 결과 중 일반 결과에 없는 것만, 해당 도메인 옵션집합으로 제한.
 * - 미지원 도메인/검색어 없음: 일반만 (grouped=false).
 */
export function useLinkSearch(
  workspaceId: string,
  activeTab: LinkableEntityType,
  query: string,
  optionsByType: Record<LinkableEntityType, EntityOption[]>
): LinkSearchResult {
  const trimmed = query.trim()
  const debounced = useDebouncedValue(trimmed, 200)
  const searchType = TO_SEARCH_TYPE[activeTab]
  const { data: hits, isFetching } = useEntitySearch(workspaceId, debounced, searchType, 'semantic')

  return useMemo(() => {
    const items = optionsByType[activeTab] ?? []

    // 검색어 없음 → 전체 목록 (그룹 없음)
    if (!trimmed) {
      return { grouped: false, keyword: items, semantic: [], semanticLoading: false, flat: items }
    }

    const lower = trimmed.toLowerCase()
    const keyword = items.filter((i) => i.title.toLowerCase().includes(lower))

    // 벡터 미지원 도메인 → 일반 검색만
    if (!searchType) {
      return { grouped: false, keyword, semantic: [], semanticLoading: false, flat: keyword }
    }

    // 벡터(의미) 결과 — 일반 결과에 이미 있는 건 제외, 도메인 옵션집합으로 제한
    const keywordIds = new Set(keyword.map((i) => i.id))
    const byId = new Map(items.map((i) => [i.id, i]))
    const semantic: EntityOption[] = []
    if (hits) {
      const seen = new Set<string>()
      for (const h of hits) {
        if (keywordIds.has(h.id) || seen.has(h.id)) continue
        const opt = byId.get(h.id)
        if (opt) {
          seen.add(h.id)
          semantic.push(opt)
        }
      }
    }

    return {
      grouped: true,
      keyword,
      semantic,
      semanticLoading: isFetching,
      flat: [...keyword, ...semantic]
    }
  }, [optionsByType, activeTab, trimmed, searchType, hits, isFetching])
}

import { useMemo } from 'react'
import { useDebouncedValue } from '@shared/hooks/use-debounced-value'
import { useEntitySearch, type SearchType } from '@entities/search'
import type { LinkableEntityType } from '@shared/lib/entity-link'

export interface EntityOption {
  type: LinkableEntityType
  id: string
  title: string
}

// 벡터/FTS 검색 지원 도메인만 매핑 (table === csv). 나머지(schedule/pdf/image)는
// 임베딩 대상이 아니라 클라이언트 제목 필터로 폴백.
const TO_SEARCH_TYPE: Partial<Record<LinkableEntityType, SearchType>> = {
  note: 'note',
  csv: 'table',
  canvas: 'canvas',
  todo: 'todo'
}

/**
 * 링크 팝업의 도메인별 검색.
 * - 지원 도메인 + 입력 안정화(debounce 완료) 시: 하이브리드(벡터+FTS) 랭킹 결과를
 *   해당 도메인 옵션 집합으로 제한해 반환 (의미 검색 포함).
 * - 그 외(미지원 도메인 / 타이핑 중 / 결과 대기): 기존 클라이언트 제목 substring 필터.
 */
export function useLinkSearch(
  workspaceId: string,
  activeTab: LinkableEntityType,
  query: string,
  optionsByType: Record<LinkableEntityType, EntityOption[]>
): EntityOption[] {
  const trimmed = query.trim()
  const debounced = useDebouncedValue(trimmed, 200)
  const searchType = TO_SEARCH_TYPE[activeTab]
  const stable = debounced === trimmed
  const { data: hits } = useEntitySearch(workspaceId, debounced, searchType)

  return useMemo(() => {
    const items = optionsByType[activeTab] ?? []
    if (!trimmed) return items

    const lower = trimmed.toLowerCase()
    const clientMatches = items.filter((i) => i.title.toLowerCase().includes(lower))

    // 하이브리드 결과를 쓸 수 없는 경우 → 클라이언트 제목 필터
    if (!searchType || !stable || !hits) return clientMatches

    // 하이브리드 랭킹 순서로 정렬하되, 현재 도메인 옵션(자기 제외/top-level todo 등 반영)에
    // 존재하는 것만. 이후 제목 매칭 중 누락분을 뒤에 덧붙여 안전망 확보.
    const byId = new Map(items.map((i) => [i.id, i]))
    const seen = new Set<string>()
    const ranked: EntityOption[] = []
    for (const h of hits) {
      const opt = byId.get(h.id)
      if (opt && !seen.has(opt.id)) {
        seen.add(opt.id)
        ranked.push(opt)
      }
    }
    for (const c of clientMatches) {
      if (!seen.has(c.id)) {
        seen.add(c.id)
        ranked.push(c)
      }
    }
    return ranked
  }, [optionsByType, activeTab, trimmed, searchType, stable, hits])
}

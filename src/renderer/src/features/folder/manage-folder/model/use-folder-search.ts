import { useCallback, useMemo, useState } from 'react'
import { useDebouncedValue } from '@shared/hooks/use-debounced-value'
import type { WorkspaceTreeNode } from './types'
import { moveActiveIndex, searchTree, type SearchResult } from './folder-search-helpers'

const DEBOUNCE_MS = 250

export interface UseFolderSearchReturn {
  /** 사용자가 입력 중인 raw 쿼리. setQuery 로 변경. */
  query: string
  setQuery: (q: string) => void
  /** 디바운스 적용된 쿼리 (실제 매칭에 사용된 값). */
  debouncedQuery: string
  /** 매칭 결과 — matched / ordered / ancestors. */
  result: SearchResult
  /** 현재 ↑↓ 활성 매치 인덱스. 매치 없음 / 미설정 시 -1. */
  activeIndex: number
  /** 활성 매치 노드 id (없으면 null). */
  activeId: string | null
  /** 다음 매치로 이동 (wrap-around). */
  goNext: () => void
  /** 이전 매치로 이동 (wrap-around). */
  goPrev: () => void
  /** 쿼리 비움 + activeIndex 초기화. */
  clear: () => void
}

/**
 * 파일 탐색기 검색 상태 훅 (Phase 1).
 *
 * - raw query → debounce (250ms) → searchTree → matchedIds / orderedMatches / ancestorIds
 * - ↑↓ wrap-around 이동 (`goNext` / `goPrev`)
 * - 새 쿼리 입력 시 activeIndex 는 첫 매치 (0) 로 초기화
 *
 * UI 부분 (검색바 / 하이라이트 / scrollTo / 폴더 자동 펼침) 은 호출 측에서 처리.
 */
export function useFolderSearch(tree: WorkspaceTreeNode[]): UseFolderSearchReturn {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)
  const [activeIndex, setActiveIndex] = useState(-1)

  const result = useMemo(() => searchTree(tree, debouncedQuery), [tree, debouncedQuery])

  // 새 쿼리 결과 도착 시 활성 인덱스를 첫 매치로 reset.
  // React 공식 권장 패턴 ("derived state without useEffect") — 두 setState 가
  // 동일 render 에 호출되어 React 가 즉시 재실행, commit 은 한 번.
  const [trackedResult, setTrackedResult] = useState(result)
  if (trackedResult !== result) {
    setTrackedResult(result)
    setActiveIndex(result.orderedMatches.length > 0 ? 0 : -1)
  }

  const goNext = useCallback(() => {
    setActiveIndex((i) => moveActiveIndex(result.orderedMatches, i, 'next'))
  }, [result.orderedMatches])

  const goPrev = useCallback(() => {
    setActiveIndex((i) => moveActiveIndex(result.orderedMatches, i, 'prev'))
  }, [result.orderedMatches])

  const clear = useCallback(() => {
    setQuery('')
    setActiveIndex(-1)
  }, [])

  const activeId =
    activeIndex >= 0 && activeIndex < result.orderedMatches.length
      ? result.orderedMatches[activeIndex]
      : null

  return {
    query,
    setQuery,
    debouncedQuery,
    result,
    activeIndex,
    activeId,
    goNext,
    goPrev,
    clear
  }
}

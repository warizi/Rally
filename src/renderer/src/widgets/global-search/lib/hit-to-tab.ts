import type { SearchType } from '@entities/search'
import type { LinkableEntityType } from '@shared/lib/entity-link'
import type { TabType } from '@shared/constants/tab-url'

/** SearchType → 도메인 아이콘/라벨 키(LinkableEntityType). table === csv. */
export const SEARCH_TO_LINKABLE: Record<SearchType, LinkableEntityType> = {
  note: 'note',
  table: 'csv',
  canvas: 'canvas',
  todo: 'todo',
  pdf: 'pdf',
  image: 'image'
}

/** 검색 결과 → openTab 옵션. (entity-link 의 toTabOptions 와 동일 매핑, FSD 슬라이스 분리를 위해 위젯 내 인라인) */
export function hitToTabOptions(
  type: SearchType,
  id: string,
  title: string
): { type: TabType; pathname: string; title: string } {
  switch (type) {
    case 'note':
      return { type: 'note', pathname: `/folder/note/${id}`, title }
    case 'table':
      return { type: 'csv', pathname: `/folder/csv/${id}`, title }
    case 'pdf':
      return { type: 'pdf', pathname: `/folder/pdf/${id}`, title }
    case 'image':
      return { type: 'image', pathname: `/folder/image/${id}`, title }
    case 'canvas':
      return { type: 'canvas-detail', pathname: `/canvas/${id}`, title }
    case 'todo':
      return { type: 'todo-detail', pathname: `/todo/${id}`, title }
  }
}

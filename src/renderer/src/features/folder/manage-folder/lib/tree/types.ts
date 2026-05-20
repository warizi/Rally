import type { CSSProperties, ReactNode, RefObject } from 'react'

/**
 * react-arborist 의존을 걷어내고 자체 구현으로 교체할 때 사용하는 트리 타입.
 *
 * 기존 react-arborist `NodeApi` / `NodeRendererProps` / `TreeApi` 의 소비 표면만 추려
 * 드롭인 호환을 유지한다. 사용 중인 속성/메서드만 노출하고 react-dnd 의존(`dragHandle` 등)은
 * 의도적으로 제외했다.
 */
export interface NodeApi<T> {
  id: string
  data: T
  level: number
  isMatch: boolean
  isActiveMatch: boolean
  childIndex: number
  isOpen: boolean
  /** 자식 보유 폴더면 true. NodeRenderer 분기에 사용. */
  isLeaf: boolean
  /** 루트 노드면 null. (react-arborist 의 가상 root sentinel 불필요) */
  parent: { id: string } | null
  tree: { indent: number }
  toggle: () => void
  open: () => void
  close: () => void
}

export interface NodeRendererProps<T> {
  node: NodeApi<T>
  /** virtualizer 가 주입하는 row wrapper style (paddingLeft 포함). */
  style: CSSProperties
}

export interface TreeApi<T> {
  /** 모든 폴더의 펼침 상태를 닫는다. openState 는 외부에서 관리되므로 콜백만 호출. */
  closeAll: () => void
  /** 폴더 id 의 현재 펼침 상태 반환. */
  isOpen: (id: string) => boolean
  /** 지정한 id 의 row 를 스크롤 영역으로 이동. */
  scrollTo: (id: string, position?: 'start' | 'center' | 'end') => void
  /** 폴더 펼침. openState 가 외부에서 관리되므로 부수효과는 onToggle 콜백에 위임. */
  open: (id: string) => void
  /** 폴더 닫음. */
  close: (id: string) => void
  /** 노드 데이터 직접 조회용 (FolderTree 의 검색/스크롤 동작에 필요). */
  get: (id: string) => NodeApi<T> | null
}

export interface TreeProps<T> {
  /** 표시할 nested 트리 데이터. */
  data: T[]
  /** 노드 id 추출자. react-arborist `idAccessor` 와 호환. */
  idAccessor: (node: T) => string
  /** 자식 추출자. null 반환 시 leaf 로 간주. */
  childrenAccessor: (node: T) => T[] | null
  /** 현재 펼침 상태 (외부 controlled). */
  openState: Record<string, boolean>
  /** 폴더 펼침/닫힘 토글 시 호출. 다음 상태를 전달한다. */
  onToggle: (id: string, nextOpen: boolean) => void
  /** 행 높이 (px). 기본 36. */
  rowHeight?: number
  /** indent 픽셀. 기본 24 (react-arborist 호환). */
  indent?: number
  /** 외부 스크롤 컨테이너 ref. 가상화 활성화 시 필수. */
  scrollElementRef: RefObject<HTMLElement | null>
  /** 행 렌더러. react-arborist render props 와 동일한 시그니처. */
  children: (props: NodeRendererProps<T>) => ReactNode
  /** 컨테이너 className. */
  className?: string
  /** 가상화 overscan (default 8). */
  overscan?: number
}

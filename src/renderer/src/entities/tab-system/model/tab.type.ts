export type TabType = 'dashboard' | 'todo' | 'todo-detail' | 'note-folder' | 'note'

export type TabIcon = TabType

// Tab은 화면 상에서 열려있는 탭 하나하나를 의미한다. Tab은 Pane 안에 존재한다.
// Tab의 정보를 바탕으로 구역 화면을 렌더링한다. Tab의 id는 pathname 기반의 고유값으로, 같은 탭이 여러 개 열리는 것을 방지한다.
export interface Tab {
  id: string // pathname 기반 고유값
  workspaceId: string
  type: TabType
  title: string
  icon: TabIcon
  pathName: string
  searchParams?: Record<string, string>
  pinned: boolean
  createdAt: number
  lastAccessedAt: number
  error?: boolean
}

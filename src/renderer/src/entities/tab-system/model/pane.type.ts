// pane은 tab 구역을 의미하며 tab이 여러 개 있을 수 있다. tab은 pane 안에서만 존재할 수 있다.
// 구역의 tab들을 관리하는 역할을 한다.
export interface Pane {
  id: string
  workspaceId: string
  tabIds: string[]
  activeTabId: string | null
  size: number
  minSize: number
}

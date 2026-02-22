// 분할 방향
export type SplitDirection = 'horizontal' | 'vertical'
// 레이아웃 노드 타입
export type LayoutNodeType = 'pane' | 'split'
// 패인 노드
export interface PaneNode {
  id: string
  workspaceId: string
  type: 'pane'
  paneId: string
}
// 분할 노드
export interface SplitNode {
  id: string
  workspaceId: string
  type: 'split'
  direction: SplitDirection
  children: LayoutNode[]
  sizes: number[]
}
// 레이아웃 노드
export type LayoutNode = PaneNode | SplitNode

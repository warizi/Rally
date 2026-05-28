export { PaneLayout } from './ui/PaneLayout'
export { PaneContainer } from './ui/PaneContainer'
export { PaneContent } from './ui/PaneContent'
export { FocusedTabOverlay } from './ui/FocusedTabOverlay'

// Tab UI (이전 features/tab-system/manage-tab-system/ui)
export { TabBar } from './ui/TabBar'
export { TabContextMenu } from './ui/TabContextMenu'
export { TabDropZone } from './ui/TabDropZone'
export { TabItem } from './ui/TabItem'

// Hooks (widget-level — UI 결합 / cross-entity 의존)
export { useTabDnd, useReorderTabs } from './model/use-tab-dnd'
export { useTabLockState } from './model/use-tab-lock-state'
export type { TabLockState } from './model/use-tab-lock-state'

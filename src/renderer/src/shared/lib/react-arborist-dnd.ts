import { createDragDropManager, type DragDropManager } from 'dnd-core'
import { HTML5Backend } from 'react-dnd-html5-backend'

// react-arborist v3의 <Tree>는 내부에서 항상 <DndProvider backend={HTML5Backend}>로 감싼다.
// HTML5Backend는 window.__isReactDndBackendSetUp 전역 플래그를 사용하므로 동시에 두 개가
// setup()되면 "Cannot have two HTML5 backends at the same time."로 throw한다.
//
// 워크스페이스 전환/분할 pane 등으로 Tree가 짧은 시간 안에 mount/unmount될 때
// DndProvider의 글로벌 singleton refcount가 0을 거치면 새 backend 인스턴스가 생성되며
// race를 일으킨다. 앱 전역에서 단 하나의 manager만 공유시키면 backend.setup()이
// 모듈 로드 시점에 1회만 수행되어 충돌이 구조적으로 제거된다.
//
// 트리 DnD는 @dnd-kit으로 통일되어 있고 react-arborist 내장 DnD는 disableDrag/disableDrop으로
// 비활성화되어 있으므로, 공유 manager가 실제 드래그 이벤트를 처리하는 일은 없다.
export const sharedArboristDndManager: DragDropManager = createDragDropManager(HTML5Backend)

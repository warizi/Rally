# Design: Tab Snapshot Restore (탭 스냅샷 복구)

## Overview

사이드바 탭 스냅샷 항목 클릭 → 저장된 탭 세션을 TabStore에 즉시 복구한다.

**[Plan] → [Design] ← 현재**

---

## 변경 파일 목록 (5개)

| #   | 파일                                                                                   | 변경 유형                                                            |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | `src/renderer/src/features/tap-system/manage-tab-system/model/use-tab-persistence.ts`  | `applySessionToStore` function export 추가                           |
| 2   | `src/renderer/src/features/tap-system/manage-tab-system/index.ts`                      | `applySessionToStore`, `SerializedTab`, `SessionData` re-export 추가 |
| 3   | `src/renderer/src/app/layout/MainSidebar.tsx`                                          | `handleRestore` + `onRestoreSnapshot` prop 전달                      |
| 4   | `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/TabSnapshotSection.tsx` | `onRestoreSnapshot` prop 수신 + `TabSnapshotItem`에 전달             |
| 5   | `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/TabSnapshotItem.tsx`    | `onRestore` prop + `SidebarMenuButton` onClick 연결                  |

---

## FSD 레이어 설계

```
app/layout/MainSidebar.tsx          ← handleRestore 정의 (app 레이어: 모든 features import 가능)
  ├── import applySessionToStore     ← from features/tap-system (합법)
  └── <TabSnapshotSection
        onRestoreSnapshot={handleRestore}   ← callback prop으로 전달 (features 간 직접 의존 없음)
      />

features/tab-snapshot/…/TabSnapshotSection   ← onRestoreSnapshot prop 수신
  └── <TabSnapshotItem onRestore={…} />       ← callback 전달

features/tab-snapshot/…/TabSnapshotItem      ← onRestore onClick 연결
  └── <SidebarMenuButton onClick={onRestore} />
```

---

## File 1 — `use-tab-persistence.ts`

**경로**: `src/renderer/src/features/tap-system/manage-tab-system/model/use-tab-persistence.ts`

`applySessionToStore`에 `export` 키워드만 추가:

```ts
// Before
function applySessionToStore(sessionData: SessionData | null): void {

// After
export function applySessionToStore(sessionData: SessionData | null): void {
```

---

## File 2 — `manage-tab-system/index.ts`

**경로**: `src/renderer/src/features/tap-system/manage-tab-system/index.ts`

```ts
// 기존
export { useSessionPersistence, sessionKeys } from './model/use-tab-persistence'

// 변경 후
export {
  useSessionPersistence,
  sessionKeys,
  applySessionToStore
} from './model/use-tab-persistence'
export type { SerializedTab, SessionData } from './model/api/queries'
```

---

## File 3 — `MainSidebar.tsx`

**경로**: `src/renderer/src/app/layout/MainSidebar.tsx`

### 추가 import

```ts
import { applySessionToStore } from '@/features/tap-system/manage-tab-system'
import type { SerializedTab, SessionData } from '@/features/tap-system/manage-tab-system'
import type { TabSnapshot } from '@entities/tab-snapshot'
```

### handleRestore 함수 (컴포넌트 내부)

```ts
const handleRestore = (snapshot: TabSnapshot): void => {
  const panes = JSON.parse(snapshot.panesJson) as SessionData['panes']
  const sessionData: SessionData = {
    tabs: JSON.parse(snapshot.tabsJson) as Record<string, SerializedTab>,
    panes,
    layout: JSON.parse(snapshot.layoutJson) as SessionData['layout'],
    activePaneId: Object.keys(panes)[0] ?? ''
  }
  applySessionToStore(sessionData)
}
```

### TabSnapshotSection 렌더링 변경

```tsx
// Before
{
  currentWorkspaceId && <TabSnapshotSection workspaceId={currentWorkspaceId} />
}

// After
{
  currentWorkspaceId && (
    <TabSnapshotSection workspaceId={currentWorkspaceId} onRestoreSnapshot={handleRestore} />
  )
}
```

---

## File 4 — `TabSnapshotSection.tsx`

**경로**: `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/TabSnapshotSection.tsx`

### Props 인터페이스 변경

```ts
// Before
interface Props {
  workspaceId: string
}

// After
interface Props {
  workspaceId: string
  onRestoreSnapshot: (snapshot: TabSnapshot) => void
}
```

### 함수 시그니처 변경

```ts
// Before
export function TabSnapshotSection({ workspaceId }: Props): JSX.Element {

// After
export function TabSnapshotSection({ workspaceId, onRestoreSnapshot }: Props): JSX.Element {
```

### TabSnapshotItem 렌더링 변경

```tsx
// Before
<TabSnapshotItem
  key={snapshot.id}
  snapshot={snapshot}
  onEdit={() => setEditTarget(snapshot)}
  onDelete={() => setDeleteTarget(snapshot)}
/>

// After
<TabSnapshotItem
  key={snapshot.id}
  snapshot={snapshot}
  onRestore={() => onRestoreSnapshot(snapshot)}
  onEdit={() => setEditTarget(snapshot)}
  onDelete={() => setDeleteTarget(snapshot)}
/>
```

---

## File 5 — `TabSnapshotItem.tsx`

**경로**: `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/TabSnapshotItem.tsx`

### Props 인터페이스 변경

```ts
// Before
interface Props {
  snapshot: TabSnapshot
  onEdit: () => void
  onDelete: () => void
}

// After
interface Props {
  snapshot: TabSnapshot
  onRestore: () => void
  onEdit: () => void
  onDelete: () => void
}
```

### 함수 시그니처 변경

```ts
// Before
export function TabSnapshotItem({ snapshot, onEdit, onDelete }: Props): JSX.Element {

// After
export function TabSnapshotItem({ snapshot, onRestore, onEdit, onDelete }: Props): JSX.Element {
```

### SidebarMenuButton onClick 추가

```tsx
// Before
<SidebarMenuButton className="cursor-pointer" tooltip={snapshot.name}>

// After
<SidebarMenuButton className="cursor-pointer" tooltip={snapshot.name} onClick={onRestore}>
```

---

## 동작 흐름 (전체)

```
1. 사용자가 사이드바에서 스냅샷 이름 클릭
   → TabSnapshotItem: SidebarMenuButton onClick={onRestore} 트리거

2. onRestore() 호출
   → TabSnapshotSection: onRestoreSnapshot(snapshot) 호출
   → MainSidebar: handleRestore(snapshot) 실행

3. handleRestore 내부:
   - snapshot.tabsJson  → JSON.parse → Record<string, SerializedTab>
   - snapshot.panesJson → JSON.parse → Record<string, Pane>
   - snapshot.layoutJson → JSON.parse → LayoutNode
   - activePaneId = Object.keys(panes)[0] ?? ''
   - applySessionToStore({ tabs, panes, layout, activePaneId })

4. applySessionToStore 내부 (기존 로직):
   - SerializedTab → Tab 역직렬화 (icon = type 복원)
   - useTabStore.setState({ tabs, panes, layout, activePaneId })

5. 결과:
   - TabStore 즉시 업데이트 → React UI 자동 리렌더링
   - useTabStore.subscribe 콜백 → throttledSave 트리거 (2초 후 DB 자동 저장)
```

---

## Non-Goals

- 복구 전 확인 다이얼로그 없음 (즉시 복구)
- 복구 완료 toast 없음 (탭 UI 변경으로 확인 가능)
- `activePaneId` DB 저장 없음 (파싱된 첫 번째 pane key 사용)
- `SaveSnapshotDialog`의 기존 FSD 위반 수정 없음 (이 플랜 범위 밖)

---

## 검증 체크리스트

- [ ] 스냅샷 저장 → 다른 탭 열기 → 스냅샷 클릭 → 저장 시점 탭 상태 복귀
- [ ] 복구 후 탭 조작 → throttle 지연 후 DB 저장 확인
- [ ] `npm run typecheck` 에러 없음

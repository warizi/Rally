# Plan: Tab Snapshot Restore (탭 스냅샷 복구)

## Overview

사이드바의 탭 스냅샷 항목을 클릭하면 저장된 탭 세션(tabs, panes, layout)을 TabStore에 복구한다.

## Goals

- 스냅샷 클릭 → 현재 탭 세션을 스냅샷 상태로 즉시 교체
- 별도 IPC 불필요 — 복구는 순수 클라이언트 측 TabStore 상태 변경
- 복구 후 탭 persistence가 자연스럽게 새 상태를 자동 저장

---

## Key Insight: 기존 `applySessionToStore` 활용

`use-tab-persistence.ts` 내부의 `applySessionToStore(sessionData)` 함수가 이미
`SessionData → TabStore` 복구 로직을 완전히 구현하고 있다:

```ts
function applySessionToStore(sessionData: SessionData | null): void {
  const restoredTabs: Record<string, Tab> = {}
  Object.entries(sessionData.tabs).forEach(([id, serialized]) => {
    restoredTabs[id] = deserializeTab(serialized) // icon = type 복원
  })
  useTabStore.setState({ tabs: restoredTabs, panes, layout, activePaneId })
}
```

→ `applySessionToStore`를 export하거나, `SessionData` 구성 후 직접 `useTabStore.setState` 호출

---

## Data Flow

```
TabSnapshotItem (click)
  → TabSnapshotSection.handleRestore(snapshot)
    → JSON.parse(snapshot.tabsJson / panesJson / layoutJson)
    → applySessionToStore({ tabs, panes, layout, activePaneId })
      → useTabStore.setState(...)
        → UI 즉시 업데이트
          → throttledSave 자동 트리거 (persistence 자동 저장)
```

### `activePaneId` 처리

`TabSnapshot`에는 `activePaneId`가 없다. 복구 시:

- `panesJson`을 파싱한 `panes` 객체의 첫 번째 key를 사용
- (`Object.keys(panes)[0]`)

---

## FSD 아키텍처 주의사항

> `features` 레이어는 다른 `features`를 import할 수 없다 (ESLint lint error).
> `features/tab-snapshot` → `features/tap-system` import는 **위반**이다.
>
> ⚠️ `SaveSnapshotDialog.tsx:11`에 이미 동일한 위반이 존재한다 (기존 tech debt).

**해결책**: 복구 로직을 `app` 레이어인 `MainSidebar.tsx`로 끌어올린다.
`app` 레이어는 모든 하위 레이어(features, entities, shared)를 import 가능하다.

---

## Files to Modify

### 1. `use-tab-persistence.ts` — `applySessionToStore` export

**`src/renderer/src/features/tap-system/manage-tab-system/model/use-tab-persistence.ts`**

```ts
// export 추가
export function applySessionToStore(sessionData: SessionData | null): void { ... }
```

### 2. `manage-tab-system/index.ts` — re-export

**`src/renderer/src/features/tap-system/manage-tab-system/index.ts`**

```ts
export {
  useSessionPersistence,
  sessionKeys,
  applySessionToStore
} from './model/use-tab-persistence'
```

`SerializedTab`, `SessionData` 타입도 함께 export 필요:

```ts
export type { SerializedTab, SessionData } from './model/api/queries'
```

(또는 `use-tab-persistence.ts`에서 re-export)

### 3. `MainSidebar.tsx` — handleRestore 로직 (app layer)

**`src/renderer/src/app/layout/MainSidebar.tsx`**

`app` 레이어는 `features/tap-system`과 `features/tab-snapshot` 모두 import 가능 → FSD 준수.

```ts
import { applySessionToStore } from '@/features/tap-system/manage-tab-system'
import type { SerializedTab, SessionData } from '@/features/tap-system/manage-tab-system'
import type { TabSnapshot } from '@entities/tab-snapshot'

// MainSidebar 컴포넌트 내부
const handleRestore = (snapshot: TabSnapshot): void => {
  const panes = JSON.parse(snapshot.panesJson) as SessionData['panes']
  const sessionData: SessionData = {
    tabs: JSON.parse(snapshot.tabsJson) as Record<string, SerializedTab>,
    panes,
    layout: JSON.parse(snapshot.layoutJson),
    activePaneId: Object.keys(panes)[0] ?? ''
  }
  applySessionToStore(sessionData)
}

// TabSnapshotSection에 prop으로 전달
{currentWorkspaceId && (
  <TabSnapshotSection
    workspaceId={currentWorkspaceId}
    onRestoreSnapshot={handleRestore}
  />
)}
```

### 4. `TabSnapshotSection.tsx` — `onRestoreSnapshot` prop 수신

**`src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/TabSnapshotSection.tsx`**

features/tap-system import 없음 → FSD 준수.

```ts
interface Props {
  workspaceId: string
  onRestoreSnapshot: (snapshot: TabSnapshot) => void  // 추가
}

// TabSnapshotItem에 전달
<TabSnapshotItem
  key={snapshot.id}
  snapshot={snapshot}
  onRestore={() => onRestoreSnapshot(snapshot)}  // 추가
  onEdit={() => setEditTarget(snapshot)}
  onDelete={() => setDeleteTarget(snapshot)}
/>
```

### 5. `TabSnapshotItem.tsx` — `onRestore` prop + onClick

**`src/renderer/src/features/tab-snapshot/manage-tab-snapshot/ui/TabSnapshotItem.tsx`**

```ts
interface Props {
  snapshot: TabSnapshot
  onRestore: () => void  // 추가
  onEdit: () => void
  onDelete: () => void
}

<SidebarMenuButton
  className="cursor-pointer"
  tooltip={snapshot.name}
  onClick={onRestore}   // 추가
>
```

### 6. `manage-tab-snapshot/index.ts` — `TabSnapshotSection` Props 타입 re-export (선택)

기존 export 유지, `TabSnapshotSection`의 Props 변경사항이 외부에서 사용 가능하도록.

---

## 기존 위반 (`SaveSnapshotDialog`) 처리 방침

이 플랜 범위 밖이지만 동일한 위반:

- `SaveSnapshotDialog.tsx:11`: `import { useTabStore } from '@/features/tap-system/manage-tab-system'`
- **후속 리팩터링** 대상: `TabSnapshotSection`이 `useTabStore.getState()`로 탭 상태를 캡처해 `SaveSnapshotDialog`에 props로 넘기거나, `MainSidebar`가 캡처 후 전달

---

## Non-Goals

- 복구 전 확인 다이얼로그 (없음 — 즉시 복구)
- 복구 완료 toast (없음 — 탭 UI가 즉시 변경되어 확인 가능)
- `activePaneId` 스냅샷 저장 (추후 개선 여지)

---

## Verification

1. 스냅샷 저장 → 다른 탭 열기 → 스냅샷 클릭 → 저장 시점 상태로 복귀 확인
2. 복구 후 탭 변경 시 persistence 자동 저장 동작 확인 (throttle 후 DB 저장)
3. `typecheck` 통과: `npm run typecheck`

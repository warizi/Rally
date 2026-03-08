# Folder Test Code Plan

## Overview

Folder 기능의 미작성 테스트 코드를 작성한다.

기존 테스트가 완료된 레이어:

- `repositories/__tests__/folder.test.ts` ✅ — DB CRUD 전체 커버
- `services/__tests__/folder.test.ts` ✅ — fs I/O + 비즈니스 로직 전체 커버
- `entities/folder/api/__tests__/queries.test.ts` ✅ — React Query hooks 커버

## 테스트 대상 (3개)

### 1. `buildWorkspaceTree` 순수 함수

**파일**: `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts`
**테스트 파일**: `src/renderer/src/features/folder/manage-folder/model/__tests__/use-workspace-tree.test.ts`

#### 사전 작업: `buildWorkspaceTree` named export 추가

현재 `buildWorkspaceTree`는 파일 내부 함수로 export되지 않는다.
순수 함수를 직접 단위 테스트하는 게 훅 전체를 통해 테스트하는 것보다 훨씬 단순하고 가치가 높으므로,
**구현 파일에서 `export` 키워드를 추가**한다.

```typescript
// use-workspace-tree.ts
export function buildWorkspaceTree(folders: FolderNode[], notes: NoteNode[]): WorkspaceTreeNode[]
```

#### 테스트 케이스

**빈 입력:**

- `([], [])` → `[]` 반환

**폴더만 (노트 없음):**

- 중첩 폴더 (`FolderNode.children` 활용) → 재귀 변환 후 children 유지
- 출력 객체를 `toEqual`로 전체 검증 (모든 필드 형태 확인)

**노트만 (폴더 없음):**

- `folderId === null` 노트들 → 루트 레벨에 `NoteTreeNode`로 추가
- `NoteNode.title → NoteTreeNode.name` 매핑 검증 (유일한 필드명 변환)
- 출력 객체를 `toEqual`로 전체 검증 (모든 필드 형태 확인)

**폴더 + 노트 혼합:**

- 폴더의 `children` 끝에 해당 `folderId` 노트 추가
- `folderId === null` 루트 노트는 루트 폴더들 뒤에 추가
- `folderId`가 존재하지 않는 폴더 id를 가진 노트 → 어디에도 표시되지 않음 (drop)

**크로스 타입 정렬 (kind 우선):**

- 하위폴더(order: 10) + 하위노트(order: 0)가 있을 때
  → 결과: `[폴더(order:10), 노트(order:0)]`
  → order 값과 무관하게 폴더가 항상 노트보다 앞에 위치함을 검증
- 루트 레벨도 동일: 폴더들 먼저, 노트들 뒤

**within-kind 정렬:**

- 루트 폴더 2개: order 오름차순 → 같은 order면 이름 알파벳순 보조
- 루트 노트 2개: order 오름차순 → 같은 order면 title 알파벳순 보조
- 중첩 폴더 children 내부도 동일 규칙 적용

---

### 2. `useTreeOpenState` 훅

**파일**: `src/renderer/src/features/folder/manage-folder/model/use-tree-open-state.ts`
**테스트 파일**: `src/renderer/src/features/folder/manage-folder/model/__tests__/use-tree-open-state.test.ts`

#### 테스트 케이스

**초기 상태:**

- localStorage에 값이 없으면 `openState = {}` 반환
- localStorage에 저장된 값이 있으면 파싱하여 반환
- localStorage.getItem이 throw하면 `{}` 반환 (예외 안전 처리)
- localStorage에 malformed JSON이 저장된 경우 (`JSON.parse` throw) → `{}` 반환 (예외 안전 처리)

**toggle:**

- `toggle('f1', true)` 후 `openState['f1'] === true`
- `toggle('f1', false)` 후 `openState['f1'] === false`
- toggle 후 `localStorage.setItem` 호출됨 (저장 검증)
- `localStorage.setItem`이 throw해도 에러 없이 처리 (예외 안전 처리)

**localStorage key 형식:**

- `folder-tree-open-state-{workspaceId}` 형식으로 저장됨
- `ws-1`과 `ws-2`는 독립적인 key를 사용 (격리 검증)

**workspaceId 변경 시 동작 (구현 특성 명시):**

- `useState` 초기값은 최초 마운트 시 1회만 실행됨
- 같은 컴포넌트 인스턴스에서 `workspaceId` prop이 변경되어도 상태는 재초기화되지 않음
- 이는 현재 구현의 의도된 동작 → 테스트로 명시하지 않음 (워크스페이스 전환 시 컴포넌트 unmount/remount로 해결)

---

### 3. `useFolderWatcher` 훅

**파일**: `src/renderer/src/entities/folder/model/use-folder-watcher.ts`
**테스트 파일**: `src/renderer/src/entities/folder/model/__tests__/use-folder-watcher.test.ts`

#### 테스트 케이스

**구독 등록:**

- 마운트 시 `window.api.folder.onChanged` 1회 호출됨

**이벤트 수신 → invalidation:**

- `onChanged` 콜백에 `workspaceId: 'ws-1'` 전달 시
  → `queryClient.invalidateQueries({ queryKey: ['folder', 'tree', 'ws-1'] })` 호출

**언마운트 cleanup:**

- 언마운트 시 `onChanged`가 반환한 unsubscribe 함수가 호출됨

---

### 4. `registerFolderHandlers` IPC 핸들러 — 작성 생략

**이유:** `folder.ts` IPC 핸들러는 `handle(() => folderService.xxx())` 형태의 얇은 위임 래퍼다.
비즈니스 로직은 서비스 레이어에 있고 `services/__tests__/folder.test.ts`에서 이미 완전히 커버된다.
IPC 핸들러 테스트를 추가해도 새로운 케이스를 검증하지 않으므로 작성하지 않는다.

---

## 구현 전략

### 파일 구조

```
src/renderer/src/
  entities/folder/model/__tests__/
    use-folder-watcher.test.ts            (NEW)
  features/folder/manage-folder/model/
    use-workspace-tree.ts                 (MODIFY: buildWorkspaceTree export 추가)
    __tests__/
      use-workspace-tree.test.ts          (NEW)
      use-tree-open-state.test.ts         (NEW)
```

### Mock 전략

**use-workspace-tree.test.ts:**

- `buildWorkspaceTree`를 직접 import하여 순수 함수 단위 테스트
- React / QueryClient 불필요 — 일반 함수 호출만으로 테스트

**use-tree-open-state.test.ts:**

- happy-dom의 내장 `localStorage` 활용 (별도 stub 불필요)
- `beforeEach`에서 `localStorage.clear()` 로 격리
- `renderHook` + `act`로 toggle 호출

**use-folder-watcher.test.ts:**

- `window.api.folder.onChanged`는 콜백을 받아 저장하고 unsubscribe 함수를 반환하는 패턴 사용:
  ```typescript
  let capturedCb: (workspaceId: string) => void
  const mockUnsubscribe = vi.fn()
  const mockOnChanged = vi.fn().mockImplementation((cb) => {
    capturedCb = cb
    return mockUnsubscribe
  })
  ```
  이벤트 시뮬레이션: `capturedCb('ws-1')` 직접 호출
- `queryClient.invalidateQueries`를 `vi.spyOn`
- `renderHook` + `unmount`로 cleanup 검증
- `renderHook`의 `wrapper`로 `QueryClientProvider` 제공

### Vitest 환경

| 테스트 파일   | 환경      | vitest config            |
| ------------- | --------- | ------------------------ |
| `renderer/**` | happy-dom | `vitest.config.web.mts`  |
| `main/**`     | node      | `vitest.config.node.mts` |

renderer 테스트에서 path alias (`@entities/folder`, `@shared` 등) 사용 가능 — `vitest.config.web.mts`에 설정됨.

---

## 우선순위

| 우선순위 | 테스트               | 이유                                         |
| -------- | -------------------- | -------------------------------------------- |
| 1        | `buildWorkspaceTree` | 복잡한 병합·정렬 로직, 순수 함수 → 최고 가치 |
| 2        | `useTreeOpenState`   | localStorage 영속 동작 보장                  |
| 3        | `useFolderWatcher`   | push 이벤트 → invalidation 연결 검증         |

---

## Success Criteria

- [ ] `buildWorkspaceTree` export 추가 (구현 파일 수정)
- [ ] `buildWorkspaceTree`: 빈 입력, 폴더만, 노트만, 혼합, 정렬, 필드 매핑 전체 커버
- [ ] `useTreeOpenState`: localStorage 읽기/쓰기/예외처리 커버
- [ ] `useFolderWatcher`: 구독 등록, 이벤트 → invalidation, 언마운트 cleanup 커버
- [ ] `npm run typecheck` 에러 없음
- [ ] `npm run test` 전체 통과

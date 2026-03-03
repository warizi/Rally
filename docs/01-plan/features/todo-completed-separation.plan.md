# Todo 완료 항목 분리 Plan

## Overview

리스트형 뷰에서 완료된 투두(isDone=true)가 미완료 투두와 섞여 표시되는 문제를 해결한다.

- 완료 시 완료 toast 알림 표시
- 메인 목록 쿼리에서 최상위 완료 투두 제외 (sub-todo는 isDone 무관하게 전체 조회)
- 메인 목록 아래 별도의 "완료된 항목" 섹션 추가 (DnD 없음, 필터 적용)
- 리스트 필터바 status 옵션에서 '완료' 항목 제거

---

## 변경 범위

```
[1단계] Backend — filter 옵션 추가
[2단계] Preload 브리지 타입/구현 업데이트
[3단계] entities/todo 쿼리 업데이트
[4단계] features/todo — 완료 목록 뷰 신규 생성 + 완료 toast + 필터바 수정
[5단계] widgets/todo — 완료 섹션 신규 생성
[6단계] pages/todo — TodoPage에 쿼리 분리 + 완료 섹션 연결
```

---

## 아키텍처 원칙

- **칸반 쿼리**: 기존 `useTodosByWorkspace(workspaceId)` 유지 — 전체 투두 반환 (칸반 '완료' 보드 필요)
- **리스트 메인 쿼리**: `useActiveTodosByWorkspace(workspaceId)` — 최상위 미완료 + 모든 sub-todo 반환
- **완료 섹션 쿼리**: `useCompletedTodosByWorkspace(workspaceId)` — 최상위 완료 투두만 반환
- `useUpdateTodo` 완료 시 세 쿼리 모두 prefix 매칭으로 자동 invalidate
- Toast는 컴포넌트 레벨에서 mutation `onSuccess` 콜백으로 처리
- 완료 섹션에는 DnD 없음, 동일한 listFilter(priority/dueDate) 적용

---

## 데이터 흐름

```
[체크박스 클릭 — isDone=true]
    ↓ updateTodo.mutate({ isDone: true })
    ↓ onSuccess → toast.success("완료!")
    ↓ invalidate [TODO_KEY, 'workspace', workspaceId] (prefix match → 세 쿼리 모두 재조회)
    ↓ 메인 목록에서 해당 투두 사라짐 (active 쿼리)
    ↓ 완료 목록에 해당 투두 나타남 (completed 쿼리)

[체크박스 클릭 — isDone=false (완료 취소)]
    ↓ updateTodo.mutate({ isDone: false })
    ↓ 완료 목록에서 사라짐 → 메인 목록에 복귀
```

---

## IPC 인터페이스 변경

### 기존

```typescript
todo:findByWorkspace (workspaceId: string) → TodoItem[]
```

### 변경 후

```typescript
todo:findByWorkspace (workspaceId: string, options?: { filter?: 'all' | 'active' | 'completed' }) → TodoItem[]
```

| filter 값           | SQL 조건                                                         | 용도        |
| ------------------- | ---------------------------------------------------------------- | ----------- |
| `'all'` 또는 미전달 | 전체 조회                                                        | 칸반 뷰     |
| `'active'`          | `(parent_id IS NULL AND is_done = 0) OR (parent_id IS NOT NULL)` | 리스트 메인 |
| `'completed'`       | `parent_id IS NULL AND is_done = 1`                              | 완료 섹션   |

> **active**: 최상위 미완료 투두 + **모든 sub-todo** (isDone 무관). 부모가 미완료이면 자식 중 완료된 sub-todo도 함께 조회해야 하므로 sub-todo에는 isDone 필터를 적용하지 않는다.
>
> **completed**: 최상위(parentId=null) 완료 투두만. 완료 섹션은 단순 테이블이므로 sub-todo 표시 없음.

---

## Renderer Layer 변경

### entities/todo/model/queries.ts

```typescript
// 기존 useTodosByWorkspace — 옵션 추가 (하위 호환 유지)
useTodosByWorkspace(workspaceId, options?: { filter?: 'all' | 'active' | 'completed' })
// queryKey: [TODO_KEY, 'workspace', workspaceId]               (filter='all' or undefined)
// queryKey: [TODO_KEY, 'workspace', workspaceId, 'active']     (filter='active')
// queryKey: [TODO_KEY, 'workspace', workspaceId, 'completed']  (filter='completed')

// 편의 훅 (신규)
useActiveTodosByWorkspace(workspaceId)    → useTodosByWorkspace(workspaceId, { filter: 'active' })
useCompletedTodosByWorkspace(workspaceId) → useTodosByWorkspace(workspaceId, { filter: 'completed' })
```

### features/todo/todo-list/model/use-todo-list.ts (수정 없음)

- `activeTodos` 를 받으면 `topLevel`이 이미 완료 투두를 포함하지 않음 (query level에서 제거됨)
- sub-todo map은 기존 로직 그대로 동작 (active 쿼리에 모든 sub-todo 포함)

### features/todo/todo-list/model/use-completed-todo-list.ts (신규, TodoPage에서 호출)

- `use-todo-list.ts`와 동일하게 **`TodoPage`에서 직접 호출** (기존 패턴 일치)
- 시그니처: `useCompletedTodoList(completedTodos: TodoItem[], filter: TodoFilter)`
- `topLevel = completedTodos.filter(t => t.parentId === null)` (query 결과가 이미 topLevel만이지만 방어적 처리)
- 필터: `applyFilter(topLevel, { ...filter, status: 'all' })` — status는 'all' 고정
- 정렬: **`doneAt DESC`** (가장 최근 완료된 항목 위)
- 반환: `{ filteredCompleted, filterActive }`

### pages/todo/ui/TodoPage.tsx (수정)

```typescript
// 기존: 단일 쿼리
const { data: todos = [] } = useTodosByWorkspace(workspaceId)

// 변경 후: 3개 쿼리 분리
const { data: todos = [] }          = useTodosByWorkspace(workspaceId)           // 칸반 전용
const { data: activeTodos = [] }    = useActiveTodosByWorkspace(workspaceId)     // 리스트 메인
const { data: completedTodos = [] } = useCompletedTodosByWorkspace(workspaceId)  // 완료 섹션

const listState      = useTodoList(activeTodos, initialListFilter)          // ← activeTodos 사용 (변경)
const completedState = useCompletedTodoList(completedTodos, listState.filter) // ← 신규, listFilter 공유
const kanbanState    = useTodoKanban(todos, ...)                             // ← 기존 todos 유지 (불변)
```

```tsx
{/* 리스트 뷰 렌더링 */}
<TodoListSection ... />
<TodoCompletedSection
  todos={completedState.filteredCompleted}
  workspaceId={workspaceId}
  filterActive={completedState.filterActive}
  onItemClick={handleItemClick}
  onItemRightClick={handleItemRightClick}
  onItemDeleted={handleItemDeleted}
  open={completedOpen}
  onOpenChange={(o) => handleSectionToggle('completedOpen', o)}
/>
```

### features/todo/todo-list/ui/TodoCompletedView.tsx (신규)

- DnD 없는 단순 Table 컴포넌트
- 컬럼: 체크박스(완료 취소) | 제목 | 중요도 badge | 완료일(doneAt) | 더보기
- 반응형: 기존 `TodoListView`와 동일한 `@container` 기준 적용
- DnD 핸들러 없음 (드래그 핸들 컬럼 제거)

### features/todo/todo-list/ui/TodoListItem.tsx (수정)

- 최상위 Todo 체크박스: `isDone=true` 완료 시 `toast.success(\`"${todo.title}" 완료!\`)` 호출
- Sub-todo 체크박스: 동일하게 toast 호출

### features/todo/filter-todo/ui/TodoFilterBar.tsx (수정)

```tsx
// 기존 status SelectItem 목록
<SelectItem value="all">전체 상태</SelectItem>
<SelectItem value="할일">할일</SelectItem>
<SelectItem value="진행중">진행중</SelectItem>
<SelectItem value="완료">완료</SelectItem>   ← 제거
<SelectItem value="보류">보류</SelectItem>
```

- `showStatus={true}` 인 리스트 뷰에서 '완료' 항목 제거
- 완료 투두는 별도 완료 섹션에서 관리하므로 메인 필터에서 선택 불필요

### widgets/todo/ui/TodoCompletedSection.tsx (신규)

- `CollapsibleSection`으로 감싼 완료 목록
- title: `완료된 항목 (${count}개)`
- 내부: `TodoCompletedView`

### widgets/todo/index.ts (수정)

- `TodoCompletedSection` export 추가

---

## 완료 섹션 필터 정책

- 리스트 뷰의 **동일한 `listFilter`** 를 완료 섹션에 전달
- `applyFilter` 호출 시 status는 `'all'` 로 override — priority/dueDate 필터만 실질 적용
- 정렬: `doneAt DESC` 고정 (필터바 정렬 옵션 미적용)

---

## Sub-todo 동작 정책

- **미완료 부모의 sub-todo**: isDone 무관하게 모두 조회되어 부모 행 접기/펼치기에 표시됨
- **완료된 부모의 sub-todo**: 완료 섹션은 단순 테이블이므로 sub-todo 표시 없음 (부모 행만 표시)
- Sub-todo가 모두 완료되면 부모도 자동완료 → 부모가 완료 섹션으로 이동 (기존 auto-complete 로직 유지)

---

## 구현 파일 목록

### 수정

1. `src/main/repositories/todo.ts` — `findByWorkspaceId(workspaceId, filter?)` 옵션 추가
2. `src/main/services/todo.ts` — `findByWorkspace(workspaceId, filter?)` options 전달
3. `src/main/ipc/todo.ts` — `options` 파라미터 추가
4. `src/preload/index.d.ts` — `TodoFindFilter` 타입 + `findByWorkspace` 시그니처 업데이트
5. `src/preload/index.ts` — ipcRenderer.invoke 호출에 options 전달
6. `src/renderer/src/entities/todo/model/queries.ts` — filter 옵션 + `useActiveTodosByWorkspace` + `useCompletedTodosByWorkspace` 추가
7. `src/renderer/src/entities/todo/index.ts` — 신규 훅 export 추가
8. `src/renderer/src/features/todo/todo-list/ui/TodoListItem.tsx` — 완료 toast 추가
9. `src/renderer/src/features/todo/filter-todo/ui/TodoFilterBar.tsx` — status '완료' 항목 제거
10. `src/renderer/src/widgets/todo/index.ts` — `TodoCompletedSection` export 추가
11. `src/renderer/src/pages/todo/ui/TodoPage.tsx` — 쿼리 3개 분리 + 완료 섹션 추가

### 신규

12. `src/renderer/src/features/todo/todo-list/model/use-completed-todo-list.ts`
13. `src/renderer/src/features/todo/todo-list/ui/TodoCompletedView.tsx`
14. `src/renderer/src/widgets/todo/ui/TodoCompletedSection.tsx`

---

## Success Criteria

- [ ] 리스트 뷰 메인 목록에 최상위 완료 투두가 표시되지 않음
- [ ] 미완료 부모의 sub-todo는 isDone 무관하게 모두 표시됨
- [ ] 체크박스로 완료 토글 시 toast.success 알림 표시 (최상위 + sub-todo 모두)
- [ ] 메인 목록 아래 "완료된 항목 (N개)" CollapsibleSection 표시
- [ ] 완료 섹션 정렬: doneAt DESC
- [ ] 완료 섹션에는 DnD 핸들 없음
- [ ] 완료 섹션에 priority/dueDate 필터 적용됨 (status 필터 무시)
- [ ] 완료 섹션에서 체크 해제 시 메인 목록으로 이동
- [ ] 완료 섹션 open/close 상태 tabSearchParams 'completedOpen' key로 유지
- [ ] 리스트 필터바 status 옵션에 '완료' 없음
- [ ] 칸반 뷰 변경 없음 (기존 useTodosByWorkspace 유지)
- [ ] TypeScript 컴파일 에러 없음

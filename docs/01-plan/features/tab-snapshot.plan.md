# Plan: Tab Snapshot (탭 스냅샷)

## Overview

현재 탭 세션(열린 탭 + 레이아웃)을 이름을 붙여 저장해두고 나중에 불러올 수 있는 기능.
사이드바의 "탭 스냅샷" 그룹에서 관리한다.

## Goals

- 현재 탭 상태(tabs, panes, layout)를 이름 붙여 저장
- 워크스페이스별 스냅샷 목록 조회/수정/삭제
- 사이드바에서 접기/펼치기, 스크롤, 저장 버튼 제공

---

## Data Model

### DB Table: `tab_snapshots`

| Column        | Type    | Constraint                         | Description                 |
| ------------- | ------- | ---------------------------------- | --------------------------- |
| `id`          | TEXT    | PK                                 | nanoid()                    |
| `name`        | TEXT    | NOT NULL                           | 스냅샷 이름                 |
| `description` | TEXT    | NULL 허용                          | 설명 (선택)                 |
| `workspaceId` | TEXT    | NOT NULL, FK→workspaces.id CASCADE | 소속 워크스페이스           |
| `tabsJson`    | TEXT    | NOT NULL                           | `Record<string, Tab>` JSON  |
| `panesJson`   | TEXT    | NOT NULL                           | `Record<string, Pane>` JSON |
| `layoutJson`  | TEXT    | NOT NULL                           | `LayoutNode` JSON           |
| `createdAt`   | INTEGER | NOT NULL                           | timestamp_ms                |
| `updatedAt`   | INTEGER | NOT NULL                           | timestamp_ms                |

> id는 tabSession의 autoIncrement integer가 아닌 nanoid text (workspace 패턴 따름)

---

## UI Spec

### 사이드바 — 탭 스냅샷 그룹

```
┌─────────────────────────────┐
│ ▼ 탭 스냅샷          (접기) │  ← SidebarGroupLabel + 토글
├─────────────────────────────┤
│  📌 작업 세션 A             │  ← 스냅샷 아이템 (context menu)
│  📌 리뷰 준비               │
│  📌 디버깅 환경             │
│  ...                        │
│  (max-height: 400px, scroll)│
├─────────────────────────────┤
│  + 현재 탭 저장             │  ← sticky bottom 버튼
└─────────────────────────────┘
```

**동작 규칙:**

- 그룹은 접기/펼치기 가능 (Collapsible 컴포넌트 활용)
- 목록 영역 max-height 400px, overflow-y scroll
- 최하단 "+ 현재 탭 저장" 버튼은 sticky (그룹 접혀도 표시 여부 TBD → 펼쳤을 때만)
- 사이드바가 collapsed(icon-only) 상태일 때는 그룹 미표시 (SidebarGroupLabel 숨김 패턴 따름)

**Context Menu (우클릭):**

- 수정: 이름/설명 변경 Dialog
- 삭제: 확인 Dialog

**"+ 현재 탭 저장" 클릭 시:**

1. 현재 TabStore(tabs, panes, layout)를 읽어 JSON 직렬화
2. 이름 입력 Dialog 표시
3. 확인 → `tabSnapshotService.create(...)` 호출
4. 목록 갱신

---

## Implementation Scope

### 1. Main Process (DB + IPC)

- `src/main/db/schema/tab-snapshot.ts` — 스키마 정의
- `src/main/db/schema/index.ts` — export 추가
- `src/main/repositories/tab-snapshot.ts` — CRUD
- `src/main/services/tab-snapshot.ts` — 비즈니스 로직 + 검증
- `src/main/ipc/tab-snapshot.ts` — IPC 핸들러 등록
- `src/main/index.ts` — `registerTabSnapshotHandlers()` 추가
- DB 마이그레이션: `npm run db:generate && npm run db:migrate`

### 2. Preload Bridge

- `src/preload/index.ts` — tabSnapshot API 추가
- `src/preload/index.d.ts` — TabSnapshotAPI 타입 정의

### 3. Renderer — Entity

- `src/renderer/src/entities/tab-snapshot/model/types.ts` — Zod 스키마 + 타입
- `src/renderer/src/entities/tab-snapshot/api/queries.ts` — React Query hooks
- `src/renderer/src/entities/tab-snapshot/index.ts` — barrel export

### 4. Renderer — Feature

- `src/renderer/src/features/tab-snapshot/manage-tab-snapshot/` 생성
  - `ui/TabSnapshotSection.tsx` — 사이드바 섹션 (접기/펼치기 + 목록 + 저장 버튼)
  - `ui/TabSnapshotItem.tsx` — 스냅샷 아이템 (컨텍스트 메뉴 포함)
  - `ui/SaveSnapshotDialog.tsx` — "현재 탭 저장" Dialog (이름 입력)
  - `ui/EditSnapshotDialog.tsx` — 수정 Dialog (이름/설명)
  - `ui/DeleteSnapshotDialog.tsx` — 삭제 확인 Dialog
  - `index.ts` — barrel export

### 5. Sidebar 연결

- `src/renderer/src/app/layout/MainSidebar.tsx` — 기존 빈 "탭 스냅샷" 그룹을 `TabSnapshotSection`으로 교체

---

## IPC API

| Channel                        | 파라미터                              | 반환                         | 설명                     |
| ------------------------------ | ------------------------------------- | ---------------------------- | ------------------------ |
| `tabSnapshot:getByWorkspaceId` | `workspaceId: string`                 | `IpcResponse<TabSnapshot[]>` | 워크스페이스 스냅샷 목록 |
| `tabSnapshot:create`           | `data: TabSnapshotInsert`             | `IpcResponse<TabSnapshot>`   | 생성                     |
| `tabSnapshot:update`           | `id: string, data: TabSnapshotUpdate` | `IpcResponse<TabSnapshot>`   | 수정                     |
| `tabSnapshot:delete`           | `id: string`                          | `IpcResponse<void>`          | 삭제                     |

---

## Key Decisions

1. **id**: nanoid text (workspace 패턴) — tabSession의 integer autoincrement와 다름
2. **description**: NULL 허용 — 선택 입력
3. **tabsJson/panesJson/layoutJson**: TabStore 현재 상태를 `JSON.stringify`로 직렬화
4. **cascade delete**: workspaceId FK에 `onDelete: 'cascade'` 적용
5. **저장 버튼 위치**: 목록 하단 sticky — Collapsible Content 내부 맨 아래 고정
6. **접기 상태**: 로컬 state (React useState) — 세션 간 유지 불필요
7. **스냅샷 복원**: 이번 scope 제외 (클릭 시 복원은 다음 iteration)

---

## Out of Scope

- 스냅샷 복원(클릭해서 탭 불러오기) — 추후
- 스냅샷 정렬/검색 — 추후
- 스냅샷 내보내기/공유 — 추후

---

## Verification Checklist

- [ ] `npm run typecheck` 통과
- [ ] 사이드바 "탭 스냅샷" 그룹 렌더링
- [ ] "+ 현재 탭 저장" → Dialog → DB 저장 → 목록 갱신
- [ ] 컨텍스트 메뉴 "수정" → Dialog → DB 업데이트
- [ ] 컨텍스트 메뉴 "삭제" → 확인 Dialog → DB 삭제
- [ ] 접기/펼치기 동작
- [ ] 목록 400px 이상 시 스크롤
- [ ] 워크스페이스 삭제 시 cascade 삭제 확인

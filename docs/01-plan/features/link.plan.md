# Plan: Link 기능

## 개요

모든 엔티티(todo, schedule, note, pdf, csv)를 서로 연결할 수 있는 범용 링크 시스템.
다대다 관계로 어떤 엔티티든 다른 엔티티와 양방향 연결이 가능하다.

## 배경

### 현재 상태 분석

**기존 schedule ↔ todo 관계 (`schedule_todos`)**

이 관계는 "범용 링크"가 아니라 **캘린더에서 todo를 표시/핸들링**하기 위한 전용 기능이다.

- DB: `schedule_todos` 정션 테이블 (scheduleId, todoId 복합 PK)
- Backend: `scheduleTodoRepository` (link/unlink/findTodosByScheduleId) 완전 구현
- Service: `scheduleService.linkTodo/unlinkTodo/getLinkedTodos` 완전 구현
- IPC: `schedule:linkTodo`, `schedule:unlinkTodo`, `schedule:getLinkedTodos` 등록 완료
- Preload: `window.api.schedule.linkTodo/unlinkTodo/getLinkedTodos` 노출 완료
- React Query: `useLinkedTodos`, `useLinkTodo`, `useUnlinkTodo` 구현 완료
- **UI 통합: 미완료** — `LinkedTodoList`, `TodoLinkPopover` 컴포넌트가 존재하지만 실제 페이지에 마운트되어 있지 않음

**결론: `schedule_todos`는 캘린더 전용 기능이므로 별도 유지하고, 범용 링크는 새 `entity_links` 테이블로 독립 구현한다.**

## 대상 엔티티

| 엔티티 | DB 테이블 | TabType | Detail Route | 생성 방식 |
|--------|----------|---------|-------------|----------|
| Todo | `todos` | `todo-detail` | `/todo/:todoId` | CreateTodoDialog |
| Schedule | `schedules` | `calendar` | `/calendar?scheduleId=:id` | ScheduleFormDialog |
| Note | `notes` | `note` | `/folder/note/:noteId` | 폴더 트리 컨텍스트 메뉴 (다이얼로그 없음) |
| PDF | `pdf_files` | `pdf` | `/folder/pdf/:pdfId` | 파일 선택기로 import (다이얼로그 없음) |
| CSV | `csv_files` | `csv` | `/folder/csv/:csvId` | 폴더 트리 컨텍스트 메뉴 (다이얼로그 없음) |

## 핵심 요구사항

### FR-01: 범용 entity_links 테이블

- 단일 `entity_links` 테이블로 모든 엔티티 간 다대다 관계 관리
- 스키마: `sourceType`, `sourceId`, `targetType`, `targetId`, `createdAt`
- 양방향 조회 지원 (A→B 링크 시 B→A도 조회 가능)
- 동일 엔티티 쌍의 중복 링크 방지

### FR-02: schedule_todos와의 관계

- `schedule_todos`는 캘린더 전용 기능으로 **그대로 유지**
- `entity_links`는 범용 연결 시스템으로 **독립 운영**
- 두 시스템은 서로 간섭하지 않음
- schedule과 todo를 entity_links로 연결해도 캘린더 기능에 영향 없음

### FR-03: 링크 CRUD API

- `link(sourceType, sourceId, targetType, targetId)` — 링크 생성
- `unlink(sourceType, sourceId, targetType, targetId)` — 링크 삭제
- `getLinkedEntities(entityType, entityId)` — 특정 엔티티에 연결된 모든 엔티티 조회 (타입별 그룹핑)
- `getLinkedEntitiesByType(entityType, entityId, targetType)` — 특정 타입만 필터 조회

### FR-04: Detail 페이지에서 링크 표시/관리

- 각 엔티티의 상세 페이지에서 연결된 엔티티 목록 표시
- 링크 추가/삭제 가능
- 엔티티 타입별 아이콘과 함께 표시
- 접기/펼치기 가능한 섹션 (SubTodoSection 패턴 참고)

### FR-05: Create 다이얼로그에서 링크 추가

- **Todo**: CreateTodoDialog에 링크 선택 UI 추가
- **Schedule**: ScheduleFormDialog에 링크 선택 UI 추가
- **Note/PDF/CSV**: 생성 다이얼로그가 없으므로 **Detail 페이지에서만** 링크 관리

### FR-06: 링크된 엔티티 클릭 시 openTab

- 링크된 엔티티를 클릭하면 해당 엔티티의 상세 페이지를 새 탭으로 열기
- 기존 `useTabStore().openTab()` 활용
- 이미 열린 탭이 있으면 해당 탭 활성화 (openTab 기본 동작)

## 기술적 결정사항

### DB: 단일 폴리모픽 테이블

5개 엔티티의 조합 = 10가지 페어 → 개별 정션 테이블 비실용적.
단일 `entity_links` + 복합 인덱스가 적합.

```sql
CREATE TABLE entity_links (
  source_type TEXT NOT NULL,  -- 'todo' | 'schedule' | 'note' | 'pdf' | 'csv'
  source_id   TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source_type, source_id, target_type, target_id)
);

-- 양방향 조회를 위한 역방향 인덱스
CREATE INDEX idx_entity_links_target
  ON entity_links (target_type, target_id, source_type, source_id);
```

### 양방향 저장 전략: 정규화된 단방향 저장

- 저장 시 **type 알파벳순으로 정렬**하여 일관성 유지
  - 예: (todo, schedule) → source=schedule, target=todo (csv < note < pdf < schedule < todo)
  - 같은 type일 경우 id 알파벳순
- 조회 시 `WHERE (source = A AND target = B) OR (source = B AND target = A)` 불필요 → 정규화 덕분에 단일 방향 조회로 충분
- 중복 방지: 정규화 + PK 제약으로 자동 보장

### 엔티티 타입 enum

```typescript
type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv'
```

### FK 없는 폴리모픽 참조

- `entity_links`의 `source_id`, `target_id`는 **FK 제약 없음** (여러 테이블 참조 불가)
- 대신 **서비스 레이어에서 존재 여부 검증**
- 엔티티 삭제 시 **서비스 레이어에서 관련 링크 정리** (cascade 불가)

## 예외 케이스 및 엣지 케이스

### EC-01: 자기 자신 링크 방지

- 같은 타입 + 같은 ID로의 링크 생성 시 `ValidationError` 발생
- 서비스 레이어에서 검증: `if (sourceType === targetType && sourceId === targetId) throw`

### EC-02: 존재하지 않는 엔티티 링크 방지

- 링크 생성 시 양쪽 엔티티 모두 존재 여부 확인
- 서비스 레이어에서 해당 repository로 findById 호출
- 미존재 시 `NotFoundError` 발생

### EC-03: 크로스 워크스페이스 링크 방지

- 서로 다른 workspace에 속한 엔티티 간 링크 금지
- 서비스 레이어에서 양쪽 엔티티의 workspaceId 일치 확인
- 불일치 시 `ValidationError` 발생
- **주의**: Note/PDF/CSV는 workspace에 직접 속하므로 workspaceId 비교 가능

### EC-04: 엔티티 삭제 시 링크 정리

FK cascade를 사용할 수 없으므로 (폴리모픽 참조), 엔티티 삭제 시 수동 정리 필요:

| 엔티티 | 삭제 방식 | 링크 정리 전략 |
|--------|----------|--------------|
| Todo | hard delete (subtodo cascade) | 서비스에서 삭제 전 `removeAllLinks('todo', todoId)` 호출 |
| Schedule | hard delete | 서비스에서 삭제 전 `removeAllLinks('schedule', scheduleId)` 호출 |
| Note | disk + DB delete | 서비스에서 삭제 전 `removeAllLinks('note', noteId)` 호출 |
| PDF | disk + DB delete | 서비스에서 삭제 전 `removeAllLinks('pdf', pdfId)` 호출 |
| CSV | disk + DB delete | 서비스에서 삭제 전 `removeAllLinks('csv', csvId)` 호출 |
| Workspace | cascade 전체 삭제 | **워크스페이스 삭제 시 bulk 정리** 필요 |

**Workspace 삭제 시**: workspace에 속한 모든 엔티티의 링크를 한번에 정리해야 한다.
→ `removeAllLinksByWorkspace(workspaceId)` 메서드 필요

### EC-05: 파일 기반 엔티티의 외부 삭제

Note/PDF/CSV는 파일 시스템 변경(외부 삭제)으로 DB와 불일치할 수 있다.
- 파일 워커가 외부 삭제를 감지하면 DB 레코드 제거 → 이때 링크도 정리되어야 함
- **폴더 삭제 시**: 하위 파일들의 folderId가 `SET NULL`되므로 파일 레코드는 유지됨 → 링크 유지

### EC-06: 중복 링크 시도

- 이미 존재하는 링크를 다시 생성 시도하면 **조용히 무시** (`INSERT OR IGNORE` / `onConflictDoNothing`)
- 기존 `scheduleTodoRepository.link()` 패턴과 동일

### EC-07: 존재하지 않는 링크 삭제 시도

- 존재하지 않는 링크를 삭제 시도하면 **조용히 무시** (DELETE 0 rows)
- 에러를 던지지 않음

### EC-08: 링크된 엔티티의 openTab 매핑

각 엔티티 타입별로 정확한 탭 열기 파라미터 필요:

```typescript
const LINK_TAB_CONFIG: Record<LinkableEntityType, (id: string) => TabOptions> = {
  todo: (id) => ({ type: 'todo-detail', pathname: `/todo/${id}`, title: '', icon: 'todo-detail' }),
  schedule: (id) => ({ type: 'calendar', pathname: '/calendar', searchParams: { scheduleId: id }, title: '캘린더', icon: 'calendar' }),
  note: (id) => ({ type: 'note', pathname: `/folder/note/${id}`, title: '', icon: 'note' }),
  pdf: (id) => ({ type: 'pdf', pathname: `/folder/pdf/${id}`, title: '', icon: 'pdf' }),
  csv: (id) => ({ type: 'csv', pathname: `/folder/csv/${id}`, title: '', icon: 'csv' }),
}
```

### EC-09: 링크 조회 시 엔티티 정보 반환

`getLinkedEntities` 호출 시 단순 ID가 아닌 **각 엔티티의 기본 정보**를 함께 반환해야 한다:

```typescript
interface LinkedEntity {
  entityType: LinkableEntityType
  entityId: string
  title: string        // 표시용 제목
  createdAt: string    // 링크 생성일
}
```

- 서비스 레이어에서 각 타입별 repository를 호출하여 title 조회
- 삭제된 엔티티(조회 실패)는 결과에서 **자동 필터링** + 해당 링크 레코드 정리

### EC-10: Todo 하위 할일(subtodo) 삭제 cascade

- 부모 todo 삭제 시 subtodo가 cascade 삭제됨 (DB FK cascade)
- 하지만 subtodo의 entity_links는 cascade되지 않음 (FK 없음)
- **해결**: todo 삭제 시 해당 todo + 모든 하위 todo의 링크를 함께 정리
- `removeAllLinks('todo', todoId)` + subtodo들도 포함

## 기존 schedule-todo 기능 영향 분석

### 영향 없음 확인

| 기존 기능 | 영향 | 이유 |
|----------|------|------|
| `schedule_todos` 테이블 | 없음 | 그대로 유지, 변경 없음 |
| `scheduleTodoRepository` | 없음 | 코드 변경 없음 |
| `scheduleService.linkTodo/unlinkTodo/getLinkedTodos` | 없음 | 코드 변경 없음 |
| `schedule:linkTodo` IPC | 없음 | 등록 유지 |
| `useLinkedTodos/useLinkTodo/useUnlinkTodo` hooks | 없음 | 코드 변경 없음 |
| `LinkedTodoList`, `TodoLinkPopover` | 없음 | 미사용 상태이며 변경 없음 |
| 캘린더 내 todo 표시 | 없음 | `todoToScheduleItem()` 로직 별개 |

### 주의: 두 시스템의 의미 차이

- `schedule_todos`: "이 일정에 이 할 일이 포함됨" (캘린더 표시 목적)
- `entity_links`: "이 엔티티와 이 엔티티가 관련됨" (범용 참조 목적)
- 같은 schedule-todo 쌍이 양쪽 모두에 존재할 수 있으며, 이는 의도된 동작

## 구현 범위

### Phase 1: DB + Backend (Main Process)

1. `entity_links` Drizzle 스키마 정의 (`src/main/db/schema/entity-link.ts`)
2. schema index.ts에 export 추가
3. 마이그레이션 생성 (`npm run db:generate`) 및 적용 (`npm run db:migrate`)
4. `entityLinkRepository` 구현 (link, unlink, findByEntity, removeAllByEntity)
5. `entityLinkService` 구현 (검증 로직, 정규화, 엔티티 정보 조회)
6. IPC 핸들러 등록 (`entityLink:link`, `entityLink:unlink`, `entityLink:getLinked`)
7. Preload bridge 타입 추가 (`window.api.entityLink.*`)
8. 기존 엔티티 삭제 서비스에 링크 정리 호출 추가 (todo, schedule, note, pdf, csv)

### Phase 2: Renderer - 공통 컴포넌트

1. React Query hooks: `useLinkedEntities`, `useLinkEntity`, `useUnlinkEntity`
2. `LinkedEntitySection` — 접기/펼치기 가능한 링크 목록 섹션 (SubTodoSection 패턴)
3. `LinkedEntityItem` — 엔티티 타입 아이콘 + 제목 + unlink 버튼 + 클릭 openTab
4. `LinkEntityPopover` — 엔티티 검색/선택 팝오버 (TodoLinkPopover 패턴)
5. openTab 유틸: `openLinkedEntityTab(entityType, entityId, title)` 헬퍼

### Phase 3: 각 엔티티 Detail에 통합

1. **TodoDetailPage**: `<SubTodoSection>` 아래에 `<LinkedEntitySection>` 추가
2. **NotePage**: 노트 에디터 상단 또는 NoteHeader 아래에 섹션 추가
3. **PdfPage**: PdfHeader 아래에 섹션 추가
4. **CsvPage**: CsvHeader 아래에 섹션 추가
5. **Schedule (캘린더)**: ScheduleDetailPopover 또는 ScheduleFormDialog에 섹션 추가

### Phase 4: Create 다이얼로그 통합

1. **CreateTodoDialog**: 폼 하단에 링크 선택 팝오버 추가
2. **ScheduleFormDialog**: 폼 하단에 링크 선택 팝오버 추가
3. **Note/PDF/CSV**: 생성 다이얼로그 없음 → Phase 3의 Detail 페이지에서만 관리

## 비기능 요구사항

- 엔티티 삭제 시 관련 링크 서비스 레이어에서 정리 (FK cascade 불가)
- 워크스페이스 삭제 시 bulk 링크 정리
- 링크 개수 제한 없음
- 링크 조회 시 삭제된 엔티티 자동 필터링 + 고아 링크 정리
- 복합 인덱스로 양방향 조회 성능 확보

## 위험 요소

| 위험 | 영향도 | 대응 |
|------|--------|------|
| FK 없는 폴리모픽 참조 → 고아 레코드 | 중 | 조회 시 자동 정리 + 삭제 시 수동 정리 |
| 5개 타입 통합 검색 UX | 중 | 타입별 탭 또는 필터로 분류 |
| subtodo cascade 시 링크 누락 | 중 | 부모 삭제 시 하위 todo 링크도 재귀 정리 |
| 외부 파일 삭제 시 고아 링크 | 하 | 조회 시 자동 필터링으로 대응 |
| 성능 (다수 링크 조회) | 하 | 역방향 인덱스로 해결 |

## 성공 기준

- 모든 5개 엔티티 간 링크 생성/삭제/조회 동작
- 기존 schedule-todo 캘린더 기능 정상 유지 (비침범)
- 링크된 엔티티 클릭 시 올바른 탭으로 이동
- 엔티티 삭제 시 관련 링크 깨끗하게 정리
- 자기 자신/크로스 워크스페이스 링크 차단
- Detail 페이지에서 링크 관리, Todo/Schedule Create 다이얼로그에서 링크 추가 가능

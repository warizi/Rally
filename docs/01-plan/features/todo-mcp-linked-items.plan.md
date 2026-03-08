# Plan: Todo MCP Tools - Linked Items 포함

## 1. 개요

MCP `list_todos` 도구가 각 todo의 linked items(연결된 항목)을 함께 반환하도록 고도화한다.
AI가 todo를 조회할 때 연결된 항목의 타입과 ID를 알 수 있어, 필요시 `read_content`, `read_canvas` 등 다른 도구로 상세 내용을 가져올 수 있게 한다.

## 2. 현재 상태 분석

### 현재 `list_todos` 응답 구조

```json
{
  "todos": [
    {
      "id": "abc123",
      "parentId": null,
      "title": "할일 제목",
      "description": "",
      "status": "할일",
      "priority": "medium",
      "isDone": false,
      "dueDate": null,
      "startDate": null,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

- linked items 정보가 전혀 포함되지 않음

### 기존 인프라

- **`entity_links` 테이블**: source/target 양방향 링크 저장 (sourceType, sourceId, targetType, targetId)
  - `normalize()` 규칙: `sourceType <= targetType` 알파벳순 저장
  - `'todo'`는 알파벳순 마지막 → 다른 타입과 링크 시 항상 targetType
- **`entityLinkService.getLinked(type, id)`**: 특정 엔티티의 모든 linked items를 resolve
  - 양방향 조회 + title resolve + orphan 자동 정리 포함
  - orphan cleanup: entity가 삭제된 링크를 발견 시 자동 DELETE (유익한 정리 동작)
- **`LinkableEntityType`**: `'todo' | 'schedule' | 'note' | 'pdf' | 'csv' | 'image' | 'canvas'`

### AI가 linked item 조회에 사용할 수 있는 기존 MCP 도구

| linked item 타입 | 사용 가능한 MCP 도구                 |
| ---------------- | ------------------------------------ |
| `note`           | `read_content` (id로 조회)           |
| `csv` (table)    | `read_content` (id로 조회)           |
| `canvas`         | `read_canvas` (canvasId로 조회)      |
| `todo`           | `list_todos`에서 이미 포함           |
| `schedule`       | 현재 MCP 도구 없음 (metadata만 인지) |
| `pdf`            | 현재 MCP 도구 없음 (metadata만 인지) |
| `image`          | 현재 MCP 도구 없음 (metadata만 인지) |

## 3. 목표 응답 구조

```json
{
  "todos": [
    {
      "id": "abc123",
      "parentId": null,
      "title": "디자인 리뷰",
      "description": "메인 페이지 디자인 리뷰",
      "status": "진행중",
      "priority": "high",
      "isDone": false,
      "dueDate": null,
      "startDate": null,
      "createdAt": "...",
      "updatedAt": "...",
      "linkedItems": [
        {
          "type": "note",
          "id": "note-xyz",
          "title": "메인 페이지 기획서"
        },
        {
          "type": "canvas",
          "id": "canvas-abc",
          "title": "UI 플로우"
        }
      ]
    }
  ]
}
```

### 핵심 포인트

- `linkedItems`는 배열 (0개 이상, 링크 없으면 빈 배열)
- 각 항목에 `type`, `id`, `title` 포함
- `type`을 통해 AI가 어떤 도구로 상세 조회할지 판단 가능
  - `note`, `csv` → `read_content` 도구 사용
  - `canvas` → `read_canvas` 도구 사용
  - `schedule`, `pdf`, `image` → 현재 상세 조회 도구 없음 (연결 관계만 인지)

## 4. 구현 범위

### 변경 대상

1. **`src/main/mcp-api/routes/mcp.ts`** - `GET /api/mcp/todos` 라우트
   - 각 todo에 대해 `entityLinkService.getLinked('todo', todoId)` 호출
   - 결과를 `linkedItems` 필드로 매핑 (`{ type, id, title }`)

2. **`src/mcp-server/tool-definitions.ts`** - `list_todos` description 업데이트
   - linked items 포함 안내 + 타입별 도구 매핑 가이드:
   ```
   Each todo includes linkedItems. To inspect a linked item:
   - type "note" or "csv" → use read_content with the id
   - type "canvas" → use read_canvas with the id as canvasId
   - type "schedule", "pdf", "image" → metadata only (no detail tool)
   ```

### 변경하지 않는 것

- DB 스키마 변경 없음 (기존 `entity_links` 테이블 활용)
- `entityLinkRepository` 변경 없음
- `entityLinkService` 변경 없음 (기존 `getLinked()` 그대로 사용)
- `manage_todos` 도구 변경 없음 (link 생성/삭제는 별도 관심사)
- `GET /api/mcp/items`의 todo summary 변경 없음 (count만 반환하므로 대상 아님)

### `getLinked()` 직접 사용 근거

- 이미 검증된 로직: 양방향 조회, normalize 규칙 처리, title resolve, orphan 필터링 모두 내장
- orphan cleanup은 유익한 정리 동작이며, 로컬 Electron + SQLite 환경에서 GET 중 write는 실질적 문제 없음
- 별도 배치 메서드 개발 대비 코드 변경 최소화 (라우트에서 map 한 줄)

## 5. 성능 고려사항

### N+1 쿼리 구조

| 단계  | 쿼리 내용                                                           | 횟수               |
| ----- | ------------------------------------------------------------------- | ------------------ |
| 1단계 | `getLinked('todo', todoId)` — 링크 조회                             | todo 수 (N)        |
| 2단계 | `findEntity(linkedType, linkedId)` — title resolve (getLinked 내부) | linked item 수 (M) |

- 총 쿼리: N + M회 (todo 100개 × 평균 2개 링크 = 약 300회)
- SQLite 로컬 DB 특성상 각 쿼리 < 1ms → 300회도 < 0.3초
- 대부분의 워크스페이스에서 todo 수백 건 이하이므로 실용적으로 문제없음
- 추후 성능 이슈 발생 시 workspace 기반 배치 쿼리로 최적화 가능 (`idx_entity_links_workspace` 인덱스 활용)

## 6. 리스크

- **낮음**: 기존 검증된 `getLinked()` 메서드를 그대로 사용하므로 안정적
- **낮음**: 응답 크기 증가 미미 (linkedItems는 type/id/title만 포함)
- **낮음**: orphan 링크는 `getLinked()` 내부에서 자동 필터링 + 정리됨

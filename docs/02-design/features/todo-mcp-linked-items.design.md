# Design: Todo MCP Tools - Linked Items 포함

> Plan: `docs/01-plan/features/todo-mcp-linked-items.plan.md`

## 1. 변경 파일 및 구현 순서

| 순서 | 파일 | 변경 내용 |
|---|---|---|
| 1 | `src/main/mcp-api/routes/mcp.ts` | `GET /api/mcp/todos` 라우트에 linkedItems 추가 |
| 2 | `src/mcp-server/tool-definitions.ts` | `list_todos` description에 linkedItems 안내 추가 |

## 2. 상세 설계

### 2-1. `src/main/mcp-api/routes/mcp.ts`

#### import 추가

```typescript
import { entityLinkService } from '../../services/entity-link'
```

#### `GET /api/mcp/todos` 라우트 변경

**Before** (L479-498):
```typescript
router.addRoute('GET', '/api/mcp/todos', (_params, _body, query) => {
  const wsId = resolveActiveWorkspace()
  const filter = (query.get('filter') as 'all' | 'active' | 'completed') || 'all'
  const todos = todoService.findByWorkspace(wsId, filter)
  return {
    todos: todos.map((t) => ({
      id: t.id,
      parentId: t.parentId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      isDone: t.isDone,
      dueDate: t.dueDate?.toISOString() ?? null,
      startDate: t.startDate?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString()
    }))
  }
})
```

**After**:
```typescript
router.addRoute('GET', '/api/mcp/todos', (_params, _body, query) => {
  const wsId = resolveActiveWorkspace()
  const filter = (query.get('filter') as 'all' | 'active' | 'completed') || 'all'
  const todos = todoService.findByWorkspace(wsId, filter)
  return {
    todos: todos.map((t) => {
      const linked = entityLinkService.getLinked('todo', t.id)
      return {
        id: t.id,
        parentId: t.parentId,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        isDone: t.isDone,
        dueDate: t.dueDate?.toISOString() ?? null,
        startDate: t.startDate?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        linkedItems: linked.map((l) => ({
          type: l.entityType,
          id: l.entityId,
          title: l.title
        }))
      }
    })
  }
})
```

#### 변경 포인트

- `todos.map` 내부에서 `entityLinkService.getLinked('todo', t.id)` 호출
- 반환값 `LinkedEntity[]`를 `{ type, id, title }` 형태로 매핑
- `linkedItems`는 항상 배열 (링크 없으면 빈 배열 `[]`)
- `getLinked()` 내부에서 orphan 자동 필터링 + 정리가 수행되므로 별도 처리 불필요

### 2-2. `src/mcp-server/tool-definitions.ts`

#### `list_todos` description 변경

**Before**:
```typescript
{
  name: 'list_todos',
  description:
    'List all todos in the active workspace. Supports filter: all, active, completed.',
  ...
}
```

**After**:
```typescript
{
  name: 'list_todos',
  description:
    `List all todos in the active workspace. Supports filter: all, active, completed.
Each todo includes linkedItems array with related items. To inspect a linked item:
- type "note" or "csv" → use read_content with the id
- type "canvas" → use read_canvas with the id as canvasId
- type "schedule", "pdf", "image" → metadata only (no detail tool available)`,
  ...
}
```

## 3. 데이터 흐름

```
MCP Client (AI)
  │
  ▼ list_todos(filter?)
MCP Server (tool-definitions.ts)
  │
  ▼ GET /api/mcp/todos?filter=...
MCP API Route (mcp.ts)
  │
  ├─▶ todoService.findByWorkspace(wsId, filter)
  │     └─▶ todoRepository.findByWorkspaceId() ─── 1회 쿼리
  │
  └─▶ todos.map → entityLinkService.getLinked('todo', todoId)  ─── N회
        │
        ├─▶ entityLinkRepository.findByEntity('todo', todoId)  ─── 링크 조회
        │
        └─▶ findEntity(linkedType, linkedId)  ─── M회 (title resolve)
              ├─ todoRepository.findById()
              ├─ noteRepository.findById()
              ├─ canvasRepository.findById()
              └─ ... (타입별 repository)
```

## 4. 응답 구조 스키마

```typescript
interface ListTodosResponse {
  todos: {
    id: string
    parentId: string | null
    title: string
    description: string
    status: '할일' | '진행중' | '완료' | '보류'
    priority: 'high' | 'medium' | 'low'
    isDone: boolean
    dueDate: string | null      // ISO 8601
    startDate: string | null    // ISO 8601
    createdAt: string           // ISO 8601
    updatedAt: string           // ISO 8601
    linkedItems: {              // NEW
      type: LinkableEntityType  // 'note' | 'csv' | 'canvas' | 'todo' | 'schedule' | 'pdf' | 'image'
      id: string
      title: string
    }[]
  }[]
}
```

## 5. 엣지 케이스

| 케이스 | 동작 |
|---|---|
| 링크 없는 todo | `linkedItems: []` (빈 배열) |
| orphan 링크 (삭제된 entity) | `getLinked()` 내부에서 필터링 + DB 정리 |
| todo-todo 링크 | 정상 반환 (type: "todo", 해당 todo의 title 포함) |
| 링크된 entity가 다른 workspace | 발생 불가 (link 생성 시 workspace 검증) |
| filter=completed 시 sub-todo 링크 | 최상위 완료 todo만 반환, sub-todo는 미포함 (기존 동작 유지) |

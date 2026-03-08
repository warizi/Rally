# MCP Server Tools Optimization Plan

## Overview

현재 MCP 서버 도구가 29개로 과다하여 AI 모델의 tool selection 효율이 떨어짐. 11개로 통합하되, 기존 기능을 모두 유지하면서 배치(batch) 지원을 추가하고, Todo 도구를 신규 추가한다.

**핵심 변경 3가지:**

1. **workspaceId 제거** — MCP 스코프는 항상 활성 워크스페이스. 모든 tool에서 workspaceId 파라미터 삭제.
2. **도메인 통합** — Note/Table은 동일 패턴이므로 하나의 도구로 합치고, Canvas 관련 3개 manage를 1개로 통합.
3. **Todo 신규 추가** — list/create/update/delete를 2개 도구로 추가 (`list_todos`, `manage_todos`).

## Current State (29 tools)

| Category    | Tools                                                                                      | Count  |
| ----------- | ------------------------------------------------------------------------------------------ | ------ |
| Workspace   | list_workspaces                                                                            | 1      |
| Folder      | list_folders, create_folder, rename_folder, delete_folder, move_folder                     | 5      |
| Note        | list_notes, read_note, write_note, create_note, rename_note, move_note, search_notes       | 7      |
| Table       | list_tables, read_table, write_table, create_table, rename_table, delete_table, move_table | 7      |
| Canvas      | list_canvases, read_canvas, create_canvas, update_canvas, delete_canvas                    | 5      |
| Canvas Node | add_canvas_node, remove_canvas_node                                                        | 2      |
| Canvas Edge | add_canvas_edge, remove_canvas_edge                                                        | 2      |
| Todo        | _(없음 — 신규 추가)_                                                                       | 0      |
| **Total**   |                                                                                            | **29** |

## Target State (11 tools)

### Consolidation Strategy

1. **workspaceId 제거**: MCP는 활성 워크스페이스에서만 동작. API 서버가 `workspaceWatcher.activeWorkspaceId`로 자동 resolve.
2. **list_workspaces 제거**: MCP 스코프가 활성 워크스페이스이므로 불필요.
3. **list 통합**: list_folders + list_notes + list_tables + list_canvases → `list_items` (1개)
4. **Note/Table 통합**: read_note + read_table → `read_content`, write + create → `write_content`, manage → `manage_items`
5. **Canvas manage 통합**: manage_canvases + manage_canvas_nodes + manage_canvas_edges → `edit_canvas` (1개)
6. **Todo 신규 추가**: 기존 MCP에 없던 Todo CRUD를 `list_todos` + `manage_todos` 2개로 추가

### Proposed Tools

| #   | Tool Name        | Replaces                                                                            | Description                                                |
| --- | ---------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | `list_items`     | list_workspaces, list_folders, list_notes, list_tables, list_canvases               | 활성 워크스페이스의 폴더+노트+테이블+캔버스+투두 전체 목록 |
| 2   | `search_notes`   | search_notes                                                                        | 노트 제목/내용 검색                                        |
| 3   | `read_content`   | read_note, read_table                                                               | 노트 또는 테이블 내용 읽기 (ID로 자동 판별)                |
| 4   | `write_content`  | create_note, write_note, create_table, write_table                                  | 노트/테이블 생성 또는 수정 (upsert)                        |
| 5   | `manage_items`   | rename_note, move_note, rename_table, move_table, delete_table + (delete_note 추가) | 노트+테이블 rename/move/delete 배치                        |
| 6   | `manage_folders` | create_folder, rename_folder, move_folder, delete_folder                            | 폴더 create/rename/move/delete 배치                        |
| 7   | `read_canvas`    | read_canvas                                                                         | 캔버스 + 노드 + 엣지 전체 읽기                             |
| 8   | `create_canvas`  | create_canvas, add_canvas_node, add_canvas_edge                                     | 캔버스 생성 (nodes + edges 한번에 포함)                    |
| 9   | `edit_canvas`    | update_canvas, delete_canvas, add/remove_canvas_node, add/remove_canvas_edge        | 캔버스 수정/삭제 + 노드/엣지 추가/제거 통합 배치           |
| 10  | `list_todos`     | _(신규)_                                                                            | 투두 목록 조회 (필터: all/active/completed)                |
| 11  | `manage_todos`   | _(신규)_                                                                            | 투두 create/update/delete 배치                             |

## Active Workspace Resolution

### 현재 구조

- `workspaceWatcher` (main process)에 `private activeWorkspaceId` / `activeWorkspacePath` 존재
- renderer의 `useCurrentWorkspaceStore`에서 workspace 전환 시 IPC로 `workspaceWatcher.startWatching(id, path)` 호출

### 변경 사항

1. `workspaceWatcher`에 public getter 추가: `getActiveWorkspaceId(): string | null`
2. MCP API에 새 라우트 그룹 `/api/mcp/...` 추가 — 자동으로 활성 워크스페이스 resolve
3. 활성 워크스페이스 없으면 400 에러: `"활성 워크스페이스가 없습니다. Rally에서 워크스페이스를 열어주세요."`

```typescript
// MCP 전용 미들웨어 패턴
function resolveActiveWorkspace(): string {
  const wsId = workspaceWatcher.getActiveWorkspaceId()
  if (!wsId) throw new ValidationError('활성 워크스페이스가 없습니다')
  return wsId
}
```

## Detailed Tool Schemas

### 1. `list_items`

```
params: {}
returns: {
  workspace: { id, name, path },
  folders: Array<{ id, relativePath, order }>,
  notes: Array<{ id, title, relativePath, preview, folderId, folderPath, updatedAt }>,
  tables: Array<{ id, title, relativePath, description, preview, folderId, folderPath, updatedAt }>,
  canvases: Array<{ id, title, description, createdAt, updatedAt }>,
  todos: { active: number, completed: number, total: number }  // 요약 카운트만
}
```

- 파라미터 없음 — 활성 워크스페이스 자동 resolve
- workspace 정보도 함께 반환하여 컨텍스트 확인 가능
- folderPath 계산을 위해 `folderRepository.findByWorkspaceId()` 1회 호출 후 공유
- todos는 전체 목록이 아닌 요약 카운트만 (상세는 `list_todos`로 조회)

### 2. `search_notes`

```
params: {
  query: string    // 검색어 (case-insensitive)
}
```

### 3. `read_content`

```
params: {
  id: string    // 노트 ID 또는 테이블 ID
}
returns: {
  type: 'note' | 'table',
  title: string,
  relativePath: string,
  content: string,
  encoding?: string        // table만 해당
}
```

- ID로 noteRepository → csvFileRepository 순서로 조회하여 타입 자동 판별
- 둘 다 없으면 NotFoundError

### 4. `write_content` (upsert)

```
params: {
  type: 'note' | 'table'    // create 시 필수, update 시 자동 판별로 생략 가능
  id?: string                // 있으면 update, 없으면 create
  title?: string             // create 시 필수
  folderId?: string          // create 시 폴더 지정
  content: string
}
returns: {
  type: 'note' | 'table',
  id: string,
  title: string,
  relativePath: string,
  created: boolean          // true = 신규 생성, false = 기존 수정
}
```

- **update** (id 있음): ID로 타입 자동 판별 → 해당 서비스의 writeContent 호출
  - note update: `noteService.writeContent()` (이미지 참조 비교 후 삭제된 이미지 자동 정리)
  - table update: `csvFileService.writeContent()`
- **create** (id 없음): type 필수 → 해당 서비스의 create + writeContent 순차 호출
- **WARNING (tool description에 포함 필수)**: note 수정 시 기존 content에 있던 이미지 참조(`![](/.images/xxx.png)`)가 새 content에서 제거되면 해당 이미지 파일이 디스크에서 삭제됨. 기존 이미지 참조를 반드시 보존할 것.

### 5. `manage_items` (batch)

```
params: {
  actions: Array<
    | { action: 'rename', id: string, newName: string }
    | { action: 'move', id: string, targetFolderId?: string }
    | { action: 'delete', id: string }
  >
}
returns: {
  results: Array<{
    action: string,
    type: 'note' | 'table',   // 자동 판별된 타입
    id: string,
    success: true
  }>
}
```

- 각 action의 id로 타입 자동 판별 (note/table)
- delete 시 note는 `noteImageService`로 참조 이미지도 정리
- 현재 MCP에 없던 note delete 기능도 추가됨

### 6. `manage_folders` (batch)

```
params: {
  actions: Array<
    | { action: 'create', name: string, parentFolderId?: string }
    | { action: 'rename', folderId: string, newName: string }
    | { action: 'move', folderId: string, parentFolderId?: string }
    | { action: 'delete', folderId: string }
  >
}
```

### 7. `read_canvas`

```
params: {
  canvasId: string
}
returns: {
  canvas: { id, title, description, createdAt, updatedAt },
  nodes: Array<{ id, type, refId, x, y, width, height, color, content, refTitle, refPreview }>,
  edges: Array<{ id, fromNode, toNode, fromSide, toSide, label, color, style, arrow }>
}
```

### 8. `create_canvas`

```
params: {
  title: string
  description?: string
  nodes?: Array<{
    type: 'text' | 'todo' | 'note' | 'schedule' | 'csv' | 'pdf' | 'image'
    x: number, y: number
    width?: number, height?: number
    content?: string, refId?: string, color?: string
  }>
  edges?: Array<{
    fromNodeIndex: number    // nodes[] 인덱스 참조 (0-based)
    toNodeIndex: number
    fromSide?: 'top' | 'right' | 'bottom' | 'left'
    toSide?: 'top' | 'right' | 'bottom' | 'left'
    label?: string, color?: string
    style?: 'solid' | 'dashed' | 'dotted'
    arrow?: 'none' | 'end' | 'both'
  }>
}
```

- 구현: `canvasService.create()` → `canvasNodeRepository.bulkCreate(nodes)` → ID 매핑 → `canvasEdgeRepository.bulkCreate(edges)`
- nodes 생성 시 nanoid()로 ID 할당 → edges의 fromNodeIndex/toNodeIndex를 실제 ID로 치환
- edge validation: self-loop 불가, 동일 방향 중복 불가
- edges만 있고 nodes가 없으면 ValidationError (인덱스 참조 대상 없음)
- returns:

```
{
  canvas: { id, title, description },
  nodes: Array<{ index, id, type, x, y, ... }>,   // index = 요청의 nodes[] 인덱스
  edges: Array<{ id, fromNode, toNode, ... }>       // 실제 node ID로 치환된 상태
}
```

### 9. `edit_canvas` (통합 batch)

```
params: {
  canvasId: string
  actions: Array<
    | { action: 'update', title?: string, description?: string }
    | { action: 'delete' }
    | { action: 'add_node', tempId?: string, type: string, x: number, y: number, width?: number, height?: number, content?: string, refId?: string, color?: string }
    | { action: 'remove_node', nodeId: string }
    | { action: 'add_edge', fromNode: string, toNode: string, fromSide?: string, toSide?: string, label?: string, color?: string, style?: string, arrow?: string }
    | { action: 'remove_edge', edgeId: string }
  >
}
```

- 하나의 캔버스에 대해 메타 수정, 삭제, 노드/엣지 추가/제거를 한번에 처리
- **delete 단독 실행**: delete action은 다른 action과 함께 사용할 수 없음. 혼합 시 ValidationError.
- **새 노드 참조 (tempId)**: 같은 batch에서 add_node → add_edge를 연결하려면:
  - add_node에 `tempId` (예: `"temp-1"`)를 지정
  - add_edge의 fromNode/toNode에 해당 `tempId`를 사용
  - 서버가 실제 nanoid() ID 할당 후 tempId → 실제 ID로 치환
  - tempId 미지정 시 기존 노드 ID만 참조 가능
- actions는 순서대로 실행: remove 먼저, add 나중에 처리하는 등의 순서 최적화는 하지 않음
- returns:

```
{
  results: Array<
    | { action: 'update', success: true }
    | { action: 'delete', success: true }
    | { action: 'add_node', tempId?: string, id: string }    // tempId→realId 매핑
    | { action: 'remove_node', nodeId: string, success: true }
    | { action: 'add_edge', id: string }
    | { action: 'remove_edge', edgeId: string, success: true }
  >
}
```

### 10. `list_todos`

```
params: {
  filter?: 'all' | 'active' | 'completed'   // default: 'all'
}
returns: {
  todos: Array<{
    id: string,
    parentId: string | null,
    title: string,
    description: string,
    status: '할일' | '진행중' | '완료' | '보류',
    priority: 'high' | 'medium' | 'low',
    isDone: boolean,
    dueDate: string | null,      // ISO 8601
    startDate: string | null,
    createdAt: string,
    updatedAt: string
  }>
}
```

- 계층 구조 (parentId)를 그대로 반환 — 클라이언트가 트리 구성
- listOrder/kanbanOrder/subOrder는 UI 전용이므로 MCP에서 제외

### 11. `manage_todos` (batch)

```
params: {
  actions: Array<
    | { action: 'create', title: string, description?: string, status?: '할일' | '진행중' | '완료' | '보류', priority?: 'high' | 'medium' | 'low', parentId?: string, dueDate?: string, startDate?: string }
    | { action: 'update', id: string, title?: string, description?: string, status?: '할일' | '진행중' | '완료' | '보류', priority?: 'high' | 'medium' | 'low', isDone?: boolean, dueDate?: string | null, startDate?: string | null }
    | { action: 'delete', id: string }
  >
}
returns: {
  results: Array<{
    action: string,
    id: string,
    success: true
  }>
}
```

- create: `todoService.create()` — order 자동 계산, parentId 유효성 검증
- update: `todoService.update()` — isDone/status/doneAt 자동 동기화, 하위 전체 완료 시 부모 자동완료
- delete: `todoService.remove()` — 하위 todo 전체 삭제, entityLink/itemTag/canvasNode/reminder 정리
- dueDate/startDate는 ISO 8601 문자열로 수신 → Date 변환

## Batch 에러 핸들링

### DB Transaction

모든 batch 작업은 **Transaction (all-or-nothing)** 방식:

- `db.$client.transaction()` 으로 감싸서 하나라도 실패 시 전체 롤백
- 이미 `canvasNodeService.syncState()`에서 동일 패턴 사용 중

### Disk I/O 안전성 (manage_folders, manage_items)

디스크 작업(fs.mkdirSync, fs.renameSync, fs.rmSync)은 DB transaction 롤백으로 원복 불가.

**manage_items** (note/table): 각 item이 독립적이므로 validate-first 가능.

1. 모든 action의 대상 존재 여부 사전 검증
2. 검증 통과 후 순차 실행 (디스크 + DB)

**manage_folders**: 폴더 rename/move 시 `bulkUpdatePathPrefix`로 하위 경로가 연쇄 변경됨.
같은 batch에서 `action 1: rename "projects"→"work"` 후 `action 2: rename "projects/docs"→...`는
action 1에 의해 경로가 변경되므로 action 2 대상이 달라짐.
→ **순차 실행 + 개별 검증** 방식 적용:

1. 각 action 실행 전 해당 시점의 DB 상태로 검증
2. 검증 통과 시 즉시 실행 (디스크 + DB)
3. 실패 시 이미 실행된 action은 롤백 불가 — 에러 응답에 `completedCount` 포함

```typescript
// manage_folders: 순차 실행 + 개별 검증
const results = []
for (const [i, action] of actions.entries()) {
  try {
    validateSingle(wsId, action) // 현재 DB 상태 기준 검증
    const result = executeSingle(wsId, action) // 디스크 + DB 실행
    results.push(result)
  } catch (error) {
    throw new ValidationError(error.message, {
      failedActionIndex: i,
      completedCount: results.length // 이미 완료된 action 수
    })
  }
}
```

### 응답 형태

```
// 성공 응답
{ results: [{ action: 'rename', id: '...', success: true }, ...] }

// 실패 응답 (전체 미실행)
{ error: 'Folder not found: abc123', failedActionIndex: 2 }
```

## Broadcast 최적화

Batch 작업 시 broadcast는 **작업 완료 후 1회만** 호출:

- 개별 action마다 broadcast하지 않음
- 영향받은 모든 relativePath를 수집하여 한번에 전달

### manage_folders

folder 작업 시 note:changed, csv:changed도 함께 broadcast (기존 패턴 유지):

```typescript
broadcastChanged('folder:changed', wsId, affectedPaths)
broadcastChanged('note:changed', wsId, [])
broadcastChanged('csv:changed', wsId, [])
```

### manage_items (note + table 혼합)

action별 타입을 추적하여 해당 채널만 broadcast:

```typescript
const noteAffectedPaths: string[] = []
const tableAffectedPaths: string[] = []
// ... 실행 시 타입별로 path 수집
if (noteAffectedPaths.length > 0) broadcastChanged('note:changed', wsId, noteAffectedPaths)
if (tableAffectedPaths.length > 0) broadcastChanged('csv:changed', wsId, tableAffectedPaths)
```

## Implementation Scope

### MCP Server (`src/mcp-server/`)

- `tool-definitions.ts` 전면 재작성 (29 tools → 11 tools, workspaceId 파라미터 전부 제거)
- `lib/call-tool.ts` 변경 없음 (HTTP client 재사용)

### Main Process (`src/main/`)

- `services/workspace-watcher.ts` — `getActiveWorkspaceId()` public getter 추가 (`activeWorkspacePath`는 불필요 — 서비스 레이어가 workspaceId로 내부에서 path resolve)
- `mcp-api/routes/` — MCP 전용 라우트 파일 추가 (활성 워크스페이스 자동 resolve)

### MCP 전용 API 엔드포인트

기존 `/api/workspaces/:wsId/...` 엔드포인트는 Electron 앱에서 사용 중이므로 유지.
MCP 전용 `/api/mcp/...` 엔드포인트를 새로 추가:

| Endpoint                           | Method | Tool                   |
| ---------------------------------- | ------ | ---------------------- |
| `/api/mcp/items`                   | GET    | list_items             |
| `/api/mcp/notes/search?q=...`      | GET    | search_notes           |
| `/api/mcp/content/:id`             | GET    | read_content           |
| `/api/mcp/content`                 | POST   | write_content (upsert) |
| `/api/mcp/items/batch`             | POST   | manage_items           |
| `/api/mcp/folders/batch`           | POST   | manage_folders         |
| `/api/mcp/canvases/:canvasId`      | GET    | read_canvas            |
| `/api/mcp/canvases`                | POST   | create_canvas          |
| `/api/mcp/canvases/:canvasId/edit` | POST   | edit_canvas            |
| `/api/mcp/todos`                   | GET    | list_todos             |
| `/api/mcp/todos/batch`             | POST   | manage_todos           |

> 11개 엔드포인트 = 11개 도구 (1:1 매핑)

### 기존 엔드포인트 처리

- `/api/workspaces/:wsId/...` — Electron 앱 IPC용, **변경 없음**
- `/api/mcp/...` — MCP 전용, 활성 워크스페이스 자동 resolve
- MCP 라우트 내부에서 기존 서비스 레이어를 그대로 호출 (코드 중복 없음)

## ID 자동 판별 로직

`read_content`, `write_content` (update), `manage_items`에서 ID로 타입을 판별:

```typescript
function resolveItemType(id: string): 'note' | 'table' {
  if (noteRepository.findById(id)) return 'note'
  if (csvFileRepository.findById(id)) return 'table'
  throw new NotFoundError(`Item not found: ${id}`)
}
```

- SQLite 로컬 DB이므로 2회 조회 비용 무시할 수 있음
- `write_content` create 시에는 type 필수 (아직 ID가 없으므로)

## Result

| Metric                    | Before                      | After                                     | Change     |
| ------------------------- | --------------------------- | ----------------------------------------- | ---------- |
| Tool count                | 29                          | 11                                        | **-62%**   |
| Parameters per tool (avg) | 2~3 (workspaceId 항상 포함) | 0~2                                       | Simplified |
| Batch support             | None                        | manage_items, manage_folders, edit_canvas | New        |
| Canvas one-shot create    | No                          | Yes (nodes+edges)                         | New        |
| Upsert pattern            | No                          | write_content                             | New        |
| Note/Table 통합           | Separate (14 tools)         | Unified (3 tools: read/write/manage)      | Merged     |
| workspaceId 노출          | Every tool                  | None                                      | Removed    |
| Todo 신규                 | 0 tools                     | 2 tools (list + manage)                   | New        |
| All features preserved    | -                           | Yes                                       | -          |

## Known Issue (기존 코드, Plan 범위 외)

`folderService.rename()`과 `folderService.move()`에서 `noteRepository.bulkUpdatePathPrefix`는 호출하지만 `csvFileRepository.bulkUpdatePathPrefix`는 호출하지 않음. workspaceWatcher가 비동기로 csv 경로를 보정하지만, MCP 동기 호출 직후에는 csv의 relativePath가 갱신되지 않은 상태일 수 있음. 이 Plan의 `manage_folders` 구현 시 csv 경로도 동기 갱신하도록 수정 권장.

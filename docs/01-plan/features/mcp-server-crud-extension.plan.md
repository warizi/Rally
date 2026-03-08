# Plan: MCP Server CRUD Extension (Table, Canvas, Folder)

## 1. Overview

기존 MCP 서버(note CRUD만 지원)에 **Table(CSV)**, **Canvas**, **Folder** CRUD 도구를 추가한다. 기존 아키텍처(MCP Server → UDS HTTP → Electron main service layer)를 그대로 따르며, 새로운 HTTP API 라우트와 MCP Tool만 추가한다.

**핵심 원칙** (기존과 동일):

- MCP 서버는 DB를 직접 조작하지 않는다
- 모든 변경은 Electron main process의 서비스 레이어를 통한다
- MCP를 통한 변경은 화면에 즉시 반영된다 (broadcastChanged)

## 2. Goals

| #               | Goal                                                                | Priority |
| --------------- | ------------------------------------------------------------------- | -------- |
| **Table (CSV)** |                                                                     |          |
| G-1             | Tool: `list_tables` — 워크스페이스의 CSV 테이블 목록                | Must     |
| G-2             | Tool: `read_table` — CSV 내용 읽기 (인코딩 자동 감지)               | Must     |
| G-3             | Tool: `write_table` — CSV 내용 저장                                 | Must     |
| G-4             | Tool: `create_table` — 새 CSV 파일 생성                             | Must     |
| G-5             | Tool: `rename_table` — CSV 이름변경                                 | Must     |
| G-6             | Tool: `delete_table` — CSV 삭제                                     | Must     |
| G-7             | Tool: `move_table` — CSV 다른 폴더로 이동                           | Should   |
| **Canvas**      |                                                                     |          |
| G-8             | Tool: `list_canvases` — 워크스페이스의 캔버스 목록                  | Must     |
| G-9             | Tool: `read_canvas` — 캔버스 상세 (노드 + 엣지 전체)                | Must     |
| G-10            | Tool: `create_canvas` — 새 캔버스 생성                              | Must     |
| G-11            | Tool: `update_canvas` — 캔버스 메타데이터 수정 (title, description) | Must     |
| G-12            | Tool: `delete_canvas` — 캔버스 삭제                                 | Must     |
| G-13            | Tool: `add_canvas_node` — 캔버스에 노드 추가                        | Should   |
| G-14            | Tool: `remove_canvas_node` — 캔버스에서 노드 제거                   | Should   |
| G-15            | Tool: `add_canvas_edge` — 캔버스에 엣지 추가                        | Should   |
| G-16            | Tool: `remove_canvas_edge` — 캔버스에서 엣지 제거                   | Should   |
| **Folder**      |                                                                     |          |
| G-17            | Tool: `create_folder` — 새 폴더 생성                                | Must     |
| G-18            | Tool: `rename_folder` — 폴더 이름변경                               | Must     |
| G-19            | Tool: `delete_folder` — 폴더 삭제 (하위 전체 포함)                  | Must     |
| G-20            | Tool: `move_folder` — 폴더 이동                                     | Should   |

## 3. Background & Context

### 3.1 현재 MCP 서버 상태

기존 MCP 서버는 note 관련 9개 도구만 제공:

- `list_workspaces`, `list_folders`(read-only), `list_notes`, `read_note`, `write_note`, `create_note`, `rename_note`, `move_note`, `search_notes`

CSV, Canvas 접근과 Folder CUD(Create/Update/Delete)는 Out of Scope으로 남아있었다.

### 3.2 기존 서비스 레이어 분석 (시그니처 검증 완료)

**CSV (csvFileService)** — 파일시스템 기반 (`src/main/services/csv-file.ts`):

| 메서드                  | 시그니처                                                                              | 반환                                  | 참고                          |
| ----------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------- |
| `readByWorkspaceFromDb` | `(workspaceId: string)`                                                               | `CsvFileNode[]`                       | DB-only 목록                  |
| `readContent`           | `(workspaceId: string, csvId: string)`                                                | `{ content, encoding, columnWidths }` | chardet 인코딩 감지           |
| `writeContent`          | `(workspaceId: string, csvId: string, content: string)`                               | `void`                                | UTF-8 저장 + preview 업데이트 |
| `create`                | `(workspaceId: string, folderId: string \| null, name: string)`                       | `CsvFileNode`                         | disk + DB                     |
| `rename`                | `(workspaceId: string, csvId: string, newName: string)`                               | `CsvFileNode`                         | disk + DB                     |
| `remove`                | `(workspaceId: string, csvId: string)`                                                | `void`                                | disk + DB + orphan cleanup    |
| `move`                  | `(workspaceId: string, csvId: string, targetFolderId: string \| null, index: number)` | `CsvFileNode`                         | disk + DB + siblings reindex  |

**Canvas (canvasService + canvasNodeService + canvasEdgeService)** — DB 전용:

| 서비스            | 메서드            | 시그니처                                               | 반환               |
| ----------------- | ----------------- | ------------------------------------------------------ | ------------------ | -------------------- |
| canvasService     | `findByWorkspace` | `(workspaceId: string, search?: string)`               | `CanvasItem[]`     |
| canvasService     | `findById`        | `(canvasId: string)`                                   | `CanvasItem`       |
| canvasService     | `create`          | `(workspaceId: string, data: { title, description? })` | `CanvasItem`       |
| canvasService     | `update`          | `(canvasId: string, data: { title?, description? })`   | `CanvasItem`       |
| canvasService     | `remove`          | `(canvasId: string)`                                   | `void`             |
| canvasNodeService | `findByCanvas`    | `(canvasId: string)`                                   | `CanvasNodeItem[]` | ref batch fetch 포함 |
| canvasNodeService | `create`          | `(canvasId: string, data: CreateCanvasNodeData)`       | `CanvasNodeItem`   |
| canvasNodeService | `remove`          | `(nodeId: string)`                                     | `void`             |
| canvasEdgeService | `findByCanvas`    | `(canvasId: string)`                                   | `CanvasEdgeItem[]` |
| canvasEdgeService | `create`          | `(canvasId: string, data: CreateCanvasEdgeData)`       | `CanvasEdgeItem`   |
| canvasEdgeService | `remove`          | `(edgeId: string)`                                     | `void`             |

**Folder (folderService)** — 파일시스템 기반 (`src/main/services/folder.ts`):

| 메서드           | 시그니처                                                                                 | 반환           | 참고                                             |
| ---------------- | ---------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------ |
| `readTreeFromDb` | `(workspaceId: string)`                                                                  | `FolderNode[]` | DB-only 트리                                     |
| `create`         | `(workspaceId: string, parentFolderId: string \| null, name: string)`                    | `FolderNode`   | disk + DB                                        |
| `rename`         | `(workspaceId: string, folderId: string, newName: string)`                               | `FolderNode`   | disk + DB + bulkUpdatePathPrefix (folder + note) |
| `remove`         | `(workspaceId: string, folderId: string)`                                                | `void`         | `fs.rmSync` 재귀 + DB bulk delete                |
| `move`           | `(workspaceId: string, folderId: string, parentFolderId: string \| null, index: number)` | `FolderNode`   | 순환 이동 방지 + disk + DB                       |

### 3.3 Watcher 이중 조작 검증 (CSV/Folder)

MCP → HTTP API → service가 DB+FS를 변경한 후, watcher가 같은 이벤트를 감지했을 때 이중 조작이 없는지 검증:

**CSV create**: `csvFileService.create()` → DB insert + `fs.writeFileSync` → watcher가 create 이벤트 감지 → `processFileTypeEvents()`에서 `findByRelativePath(rel)` → **이미 존재 → skip**. 이중 insert 없음.

**CSV writeContent**: `csvFileService.writeContent()` → `fs.writeFileSync` → watcher가 update 이벤트 감지 → `processFileTypeEvents()`는 create/delete만 처리, **update는 무시** → `pushChanged`만 호출. 이중 DB 조작 없음.

**CSV rename**: `csvFileService.rename()` → DB update(새 경로) + `fs.renameSync` → watcher가 delete(old)+create(new) 감지 → rename 감지 로직에서 `findByRelativePath(oldRel)` → **null (이미 업데이트됨)** → skip → standalone create에서도 `findByRelativePath(newRel)` → **이미 존재** → skip. 이중 처리 없음.

**CSV remove**: `csvFileService.remove()` → DB delete + `fs.unlinkSync` → watcher가 delete 이벤트 감지 → `processFileTypeEvents()`에서 `findByRelativePath(rel)` → **null (이미 삭제됨)** → skip. 이중 삭제 없음.

**CSV move**: rename과 동일 패턴. 이중 처리 없음.

**Folder create**: `folderService.create()` → DB insert + `fs.mkdirSync` → watcher가 create 이벤트 감지 → `findByRelativePath(rel)` → **이미 존재** → skip. 이중 insert 없음.

**Folder rename**: `folderService.rename()` → `folderRepository.bulkUpdatePathPrefix` + `noteRepository.bulkUpdatePathPrefix` + `fs.renameSync` → watcher가 delete(old)+create(new) 감지 → rename 감지에서 `findByRelativePath(oldRel)` → **null** → skip. 이중 처리 없음.

**Folder remove**: `folderService.remove()` → `fs.rmSync(recursive)` + DB bulk delete → watcher가 delete 이벤트 감지 → `findByRelativePath(rel)` → **null** → skip. 이중 삭제 없음.

**Folder move**: rename과 동일 패턴. 이중 처리 없음.

> **결론**: 모든 CSV/Folder 서비스 메서드에서 watcher 이중 조작 문제 없음. 기존 note 검증(mcp-server.plan.md)과 동일한 패턴으로 안전.

### 3.4 Folder rename/move의 cascade 효과

`folderService.rename()`과 `move()`는 다음을 호출한다:

- `folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)` — 하위 폴더 경로 갱신
- `noteRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)` — 하위 note 경로 갱신

**하지만 csv/pdf/image의 `bulkUpdatePathPrefix`는 호출하지 않는다.** 이들의 경로 갱신은 watcher에게 맡기는 설계.

| 상황                 | csv/pdf/image 경로 갱신 방법                                                                          | 비고                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 활성 ws + UI 조작    | watcher의 `applyEvents()` → `config.repository.bulkUpdatePathPrefix()` (workspace-watcher.ts:278-279) | 정상                                                            |
| 활성 ws + MCP 조작   | 동일 — watcher가 FS rename 이벤트 감지                                                                | 정상                                                            |
| 비활성 ws + MCP 조작 | **watcher 없음** → csv/pdf/image DB 경로 stale                                                        | 워크스페이스 전환 시 `reconcileFileType()`으로 FS ↔ DB 재동기화 |

> **결론**: 비활성 워크스페이스에서 MCP로 폴더 rename/move 시 csv/pdf/image의 DB 경로가 즉시 갱신되지 않지만, **워크스페이스 전환 시 자동 복구**된다. 기존 앱에서도 비활성 ws의 외부 변경은 동일하게 처리하므로 새로운 문제가 아님.

### 3.5 Folder delete의 하위 엔티티 DB 정리

`folderService.remove()`의 동작:

1. `fs.rmSync(absPath, { recursive: true, force: true })` — 디스크에서 재귀 삭제
2. `itemTagService.removeByItem('folder', folderId)` — 폴더 태그 정리
3. `folderRepository.bulkDeleteByPrefix(workspaceId, folder.relativePath)` — 하위 폴더 DB 삭제

**하위 note/csv/pdf/image DB 레코드는 직접 삭제하지 않는다.**

FK 동작: `folderId → folders.id` (`onDelete: 'set null'`)

- Folder DB 삭제 시 하위 엔티티의 `folderId`가 `null`로 변경됨
- 실제 파일은 이미 삭제되었으므로 DB에 orphan 레코드가 남음
- 활성 ws: watcher가 delete 이벤트로 orphan 정리
- 비활성 ws: 전환 시 reconciliation으로 정리

> **MCP 관점**: folder delete 후 `note:changed` + `csv:changed` broadcast 시, renderer가 목록을 re-fetch하면 orphan 레코드가 보일 수 있다 (파일 없는 항목). 그러나 이는 watcher 또는 reconciliation이 곧 정리하므로 일시적 현상.

### 3.6 Canvas renderer invalidation 패턴

Canvas는 push 채널 없이 IPC mutation의 `onSuccess`에서 직접 invalidate한다:

```
useCreateCanvas   → onSuccess → invalidate(['canvas', 'workspace', wsId])
useUpdateCanvas   → onSuccess → invalidate(['canvas', 'workspace', wsId]) + setQueryData(['canvas', 'detail', id])
useRemoveCanvas   → onSuccess → invalidate(['canvas', 'workspace', wsId])
useCreateCanvasNode → onSuccess → invalidate(['canvasNode', 'canvas', canvasId])
useRemoveCanvasNode → onSuccess → invalidate(['canvasNode', 'canvas', canvasId]) + invalidate(['canvasEdge', 'canvas', canvasId])
useCreateCanvasEdge → onSuccess → invalidate(['canvasEdge', 'canvas', canvasId])
useRemoveCanvasEdge → onSuccess → invalidate(['canvasEdge', 'canvas', canvasId])
```

MCP를 통한 변경 시 이 `onSuccess`가 호출되지 않으므로, 별도의 push 채널이 필요하다.

### 3.7 워크스페이스 소유권 비검증

Canvas 관련 서비스는 워크스페이스 소유권을 검증하지 않는다:

- `canvasService.findById(canvasId)` — canvasId만으로 조회, wsId 미사용
- `canvasService.update(canvasId, data)` — canvasId만으로 업데이트
- `canvasService.remove(canvasId)` — canvasId만으로 삭제
- `canvasNodeService.remove(nodeId)` — nodeId만으로 삭제
- `canvasEdgeService.remove(edgeId)` — edgeId만으로 삭제

기존 IPC 핸들러도 동일 패턴을 사용하므로, MCP HTTP API에서도 URL의 `:wsId`는 일관성을 위한 것이지 검증에는 사용하지 않는다. CSV의 경우 `readContent`에서 `workspace.path + csv.relativePath`로 파일 경로를 구성하므로, 다른 ws의 csvId를 전달하면 파일 경로 불일치로 자연스럽게 에러가 발생한다 (간접적 보호).

### 3.8 canvasGroups 미구현 상태

`src/main/db/schema/canvas-group.ts`에 `canvasGroups` 테이블 스키마가 정의되어 있으나, 대응하는 service, repository, IPC 핸들러가 **존재하지 않는다**. 미구현 기능이므로 MCP에서도 제외한다.

### 3.3 broadcastChanged 채널 매핑 (코드 검증 완료)

서비스별로 renderer가 listen하는 채널이 다르다:

| 엔티티 | 채널             | preload 리스너                | renderer watcher                             | invalidation queryKey                               |
| ------ | ---------------- | ----------------------------- | -------------------------------------------- | --------------------------------------------------- |
| Note   | `note:changed`   | `window.api.note.onChanged`   | `useFileWatcher` (`use-note-watcher.ts`)     | `['note', 'workspace', wsId]` + content refetch     |
| CSV    | `csv:changed`    | `window.api.csv.onChanged`    | `useFileWatcher` (`use-csv-watcher.ts`)      | `['csv', 'workspace', wsId]` + content refetch      |
| Folder | `folder:changed` | `window.api.folder.onChanged` | `useFolderWatcher` (`use-folder-watcher.ts`) | `['folder', 'tree', wsId]`                          |
| Canvas | **없음**         | **없음**                      | **없음**                                     | 없음 (IPC mutation의 onSuccess에서 직접 invalidate) |

#### Canvas broadcast 부재 문제와 해결

Canvas는 DB-only 엔티티로 FS watcher가 불필요하여 push 메커니즘이 없다. Renderer에서 Canvas 데이터는 IPC mutation의 `onSuccess` 콜백에서 직접 `queryClient.invalidateQueries()`를 호출하여 갱신한다 (섹션 3.6 참고).

**MCP를 통한 Canvas 변경 시 renderer가 자동으로 감지할 수 없다.**

해결 방안:

1. **새로운 `canvas:changed` 채널 추가**:
   - `src/preload/index.ts`의 canvas 객체에 `onChanged: createOnChangedListener('canvas:changed')` 추가
   - `src/renderer/src/entities/canvas/model/use-canvas-watcher.ts` 신규 생성
   - `src/renderer/src/app/layout/MainLayout.tsx`에서 `useCanvasWatcher()` 호출
2. `useCanvasWatcher`에서 invalidate할 queryKey:
   - `['canvas', 'workspace', wsId]` — 캔버스 목록
   - `['canvasNode', 'canvas', *]` — 노드 목록 (canvasId 특정 불가하므로 와일드카드)
   - `['canvasEdge', 'canvas', *]` — 엣지 목록
3. Canvas broadcast의 `paths` 파라미터는 빈 배열 `[]`로 전달 (Canvas에는 relativePath 개념 없음)
4. `broadcastChanged` 시그니처 `(channel, wsId, paths: string[])`는 그대로 사용 가능
5. `useFileWatcher`는 `relativePath` 매칭 기반이라 Canvas에 부적합 → **별도 watcher** 작성 필요 (`useFolderWatcher`처럼 단순 invalidation)

> **preload 타입 영향**: `src/preload/index.d.ts`에도 `canvas.onChanged` 타입 추가 필요

#### broadcastChanged 호출 시 paths 파라미터 가이드

`useFileWatcher`는 두 단계로 동작한다:

1. **항상**: 목록 캐시 invalidate (`[prefix, 'workspace', wsId]`) — paths 값과 무관
2. **paths.length > 0일 때만**: 경로 매칭으로 해당 아이템의 content refetch + 외부 변경 토스트 표시

따라서 content가 변경되는 작업에서는 **반드시 relativePath를 포함**해야 열려있는 탭의 content가 즉시 갱신된다.

| 엔티티        | 작업                       | paths 값                                       | 이유 |
| ------------- | -------------------------- | ---------------------------------------------- | ---- |
| CSV write     | `[csv.relativePath]`       | content refetch 필요 (열려있는 탭)             |
| CSV rename    | `[oldRelPath, newRelPath]` | note 패턴과 동일                               |
| CSV move      | `[oldRelPath, newRelPath]` | note 패턴과 동일                               |
| CSV delete    | `[csv.relativePath]`       | 삭제된 항목의 캐시 정리                        |
| CSV create    | `[newRelPath]`             | 목록 invalidation (content는 비어있음)         |
| Canvas 전체   | `[]`                       | relativePath 개념 없음, 목록 캐시만 invalidate |
| Folder create | `[newRelPath]`             | 트리 캐시 invalidation + 토스트                |
| Folder rename | `[newRelPath]`             | 트리 캐시 invalidation                         |
| Folder delete | `[deletedRelPath]`         | 트리 캐시 invalidation                         |
| Folder move   | `[newRelPath]`             | 트리 캐시 invalidation                         |

> **중요**: Folder rename/move/delete 시 하위 note/csv 경로도 영향받으므로, `note:changed` + `csv:changed`도 추가 broadcast해야 한다. 이 경우 paths는 빈 배열 `[]`로 충분 (목록 캐시 전체 invalidation).

#### DELETE 메서드 라우터 호환성

기존 라우터는 GET이 아닌 모든 메서드에서 `parseBody(req)`를 호출한다. DELETE 요청은 body가 비어있을 수 있으므로, `parseBody`가 빈 body를 정상 처리하는지 확인 필요.

```typescript
// router.ts:90 — GET이 아니면 body 파싱
const body = method === 'GET' ? null : await parseBody(req)
```

> **확인 완료**: `parseBody`는 `size === 0`이면 `null`을 반환한다 (`body-parser.ts:31-33`). DELETE 요청에 body가 없어도 정상 동작. 수정 불필요.

## 4. Scope

### 4.1 In Scope

| Item                       | Description                                                                  |
| -------------------------- | ---------------------------------------------------------------------------- |
| HTTP API 라우트 추가       | `src/main/mcp-api/routes/`에 csv.ts, canvas.ts 추가 + folder.ts 확장         |
| MCP Tool 추가              | `src/mcp-server/tool-definitions.ts`에 새 도구 등록                          |
| broadcastChanged 호출      | 각 변경 API 핸들러에서 적절한 채널로 broadcast                               |
| Canvas push 채널 신규 구현 | `canvas:changed` preload 리스너 + renderer watcher 추가 (현재 존재하지 않음) |
| MCP 서버 재빌드            | tsup으로 새 도구 포함하여 빌드                                               |

### 4.2 Out of Scope

| Item                                             | Reason                                        |
| ------------------------------------------------ | --------------------------------------------- |
| Canvas 노드 위치 일괄 업데이트 (updatePositions) | AI가 좌표를 직접 다루기 부적합                |
| Canvas syncState (전체 상태 동기화)              | 복잡도 높음, UI 전용 기능                     |
| CSV columnWidths 관리                            | UI 전용 메타데이터                            |
| Note 삭제                                        | 기존 plan에서 이미 out of scope (위험성)      |
| Folder updateMeta (color 변경)                   | UI 전용 기능                                  |
| Canvas Group CRUD                                | 스키마만 존재, service/repository 미구현 상태 |

## 5. Constraints

| #   | Constraint                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------ |
| C-1 | 기존 MCP 아키텍처(2-계층 프록시) 유지                                                                        |
| C-2 | 기존 note 관련 9개 도구에 영향 없음                                                                          |
| C-3 | CSV는 파일시스템 연동 (disk + DB), Canvas는 DB-only                                                          |
| C-4 | Folder 삭제 시 하위 note/csv도 함께 삭제됨 — Tool description에 경고 필수                                    |
| C-5 | Canvas 삭제 시 하위 node/edge FK CASCADE로 자동 삭제                                                         |
| C-6 | broadcastChanged 채널은 기존 renderer 리스너와 일치해야 함                                                   |
| C-7 | Canvas에는 현재 push 채널이 없으므로 `canvas:changed` 채널을 preload + renderer에 신규 구현해야 함           |
| C-8 | Folder rename/move/delete 시 하위 note/csv 경로도 변경되므로 `note:changed` + `csv:changed`도 함께 broadcast |

## 6. Tool Specifications

### 6.1 Table (CSV) Tools

#### `list_tables`

- **Input**: `{ workspaceId: string }`
- **Output**: `{ tables: [{ id, title, relativePath, description, preview, folderId, folderPath, updatedAt }] }`
- **Service**: `csvFileService.readByWorkspaceFromDb(workspaceId)` → `CsvFileNode[]` + `folderRepository.findByWorkspaceId(workspaceId)` → folder Map 생성 → `folderPath` 조인
- **참고**: `CsvFileNode`에는 `folderId`만 존재. HTTP 핸들러에서 `list_notes`와 동일한 folder Map 패턴으로 `folderPath` 필드 추가. `list_notes`의 기존 코드 (mcp-api/routes/note.ts:16-31) 참조
- **HTTP**: `GET /api/workspaces/:wsId/tables`

#### `read_table`

- **Input**: `{ workspaceId: string, tableId: string }`
- **Output**: `{ title, relativePath, content, encoding }`
- **Service**: `csvFileRepository.findById(tableId)` (메타데이터) + `csvFileService.readContent(workspaceId, tableId)` → `{ content, encoding, columnWidths }`
- **참고**: `readContent()`는 title/relativePath를 반환하지 않으므로, `findById()`로 메타데이터 조합 필요 (`read_note`와 동일 패턴). `columnWidths`는 UI 전용이므로 MCP 응답에서 제외
- **HTTP**: `GET /api/workspaces/:wsId/tables/:tableId/content`

#### `write_table`

- **Input**: `{ workspaceId: string, tableId: string, content: string }`
- **Output**: `{ success: true, title, relativePath }`
- **Service**: `csvFileRepository.findById(tableId)` (메타데이터) + `csvFileService.writeContent(workspaceId, tableId, content)` → `void`
- **참고**: `writeContent()`는 `void` 반환. 사전 `findById()`로 title/relativePath 조회 필요 (`write_note`와 동일 패턴). `writeContent()` 내부에서 preview 자동 업데이트됨
- **Tool Description**: "Update the content of an existing CSV table. WARNING: This replaces the entire file content. Read the table first and modify the content to avoid data loss."
- **HTTP**: `PUT /api/workspaces/:wsId/tables/:tableId/content`
- **Broadcast**: `csv:changed` — paths: `[csv.relativePath]`

#### `create_table`

- **Input**: `{ workspaceId: string, folderId?: string, title: string, content?: string }`
- **Output**: `{ id, title, relativePath }`
- **Service**: `csvFileService.create(workspaceId, folderId, title)` → `CsvFileNode`. content 있으면 `csvFileService.writeContent(workspaceId, id, content)` 연속 호출
- **타입 매핑**: `folderId?: string` → `folderId: string | null` (핸들러에서 `body.folderId ?? null`)
- **참고**: service 파라미터명은 `name` (Tool Input의 `title` → service의 `name`으로 매핑). `create_note`와 동일 패턴
- **HTTP**: `POST /api/workspaces/:wsId/tables`
- **Broadcast**: `csv:changed` — paths: `[result.relativePath]`

#### `rename_table`

- **Input**: `{ workspaceId: string, tableId: string, newName: string }`
- **Output**: `{ id, title, relativePath }`
- **Service**: `csvFileRepository.findById(tableId)` (old path 캡처) + `csvFileService.rename(workspaceId, tableId, newName)` → `CsvFileNode`
- **중요**: rename 호출 전 old path를 미리 캡처해야 함 (`rename_note`와 동일 패턴)
- **HTTP**: `PATCH /api/workspaces/:wsId/tables/:tableId/rename`
- **Broadcast**: `csv:changed` — paths: `[oldRelPath, result.relativePath]`

#### `delete_table`

- **Input**: `{ workspaceId: string, tableId: string }`
- **Output**: `{ success: true }`
- **Service**: `csvFileRepository.findById(tableId)` (relativePath 캡처) + `csvFileService.remove(workspaceId, tableId)` → `void`
- **HTTP**: `DELETE /api/workspaces/:wsId/tables/:tableId`
- **Broadcast**: `csv:changed` — paths: `[csv.relativePath]`

#### `move_table`

- **Input**: `{ workspaceId: string, tableId: string, targetFolderId?: string }`
- **Output**: `{ id, title, relativePath, folderId }`
- **Service**: `csvFileRepository.findById(tableId)` (old path 캡처) + `csvFileService.move(workspaceId, tableId, targetFolderId, 0)` → `CsvFileNode`
- **타입 매핑**: `targetFolderId?: string` → `targetFolderId: string | null` (핸들러에서 `body.targetFolderId ?? null`)
- **HTTP**: `PATCH /api/workspaces/:wsId/tables/:tableId/move`
- **Broadcast**: `csv:changed` — paths: `[oldRelPath, result.relativePath]`

### 6.2 Canvas Tools

#### `list_canvases`

- **Input**: `{ workspaceId: string }`
- **Output**: `{ canvases: [{ id, title, description, createdAt, updatedAt }] }`
- **Service**: `canvasService.findByWorkspace(workspaceId)`
- **HTTP**: `GET /api/workspaces/:wsId/canvases`

#### `read_canvas`

- **Input**: `{ workspaceId: string, canvasId: string }`
- **Output**:
  ```json
  {
    "canvas": { "id", "title", "description", "createdAt", "updatedAt" },
    "nodes": [{
      "id", "canvasId", "type", "refId", "x", "y", "width", "height",
      "color", "content", "zIndex",
      "refTitle", "refPreview", "refMeta"
    }],
    "edges": [{
      "id", "canvasId", "fromNode", "toNode", "fromSide", "toSide",
      "label", "color", "style", "arrow"
    }]
  }
  ```
- **Service**: `canvasService.findById(canvasId)` → `CanvasItem` + `canvasNodeService.findByCanvas(canvasId)` → `CanvasNodeItem[]` (내부에서 `batchFetchRefs()` 호출하여 refTitle/refPreview/refMeta 포함) + `canvasEdgeService.findByCanvas(canvasId)` → `CanvasEdgeItem[]`
- **참고**: `findById(canvasId)`는 canvasId만으로 동작 — wsId는 URL 일관성용. ref 노드(todo/note/schedule/csv/pdf/image)의 제목과 미리보기가 `refTitle`/`refPreview`로 포함되어 AI가 캔버스 구조를 이해할 수 있음
- **HTTP**: `GET /api/workspaces/:wsId/canvases/:canvasId`

#### `create_canvas`

- **Input**: `{ workspaceId: string, title: string, description?: string }`
- **Output**: `{ id, title, description }`
- **Service**: `canvasService.create(workspaceId, { title, description })` → `CanvasItem`
- **HTTP**: `POST /api/workspaces/:wsId/canvases`
- **Broadcast**: `canvas:changed` — paths: `[]`

#### `update_canvas`

- **Input**: `{ workspaceId: string, canvasId: string, title?: string, description?: string }`
- **Output**: `{ id, title, description }`
- **Service**: `canvasService.update(canvasId, { title, description })` → `CanvasItem`
- **참고**: `update()`는 `canvasId`만으로 동작 (wsId는 URL 일관성용). `title`과 `description` 모두 optional — 최소 하나는 제공되어야 의미있음. 핸들러에서 validation 추가 고려
- **HTTP**: `PATCH /api/workspaces/:wsId/canvases/:canvasId`
- **Broadcast**: `canvas:changed` — paths: `[]`

#### `delete_canvas`

- **Input**: `{ workspaceId: string, canvasId: string }`
- **Output**: `{ success: true }`
- **Service**: `canvasService.remove(canvasId)` → `void`. 내부에서 `itemTagService.removeByItem('canvas', canvasId)` + `canvasRepository.delete(canvasId)` 호출. FK CASCADE로 node/edge 자동 삭제
- **Tool Description**: "WARNING: This permanently deletes the canvas and all its nodes and edges."
- **HTTP**: `DELETE /api/workspaces/:wsId/canvases/:canvasId`
- **Broadcast**: `canvas:changed` — paths: `[]`

#### `add_canvas_node`

- **Input**: `{ workspaceId: string, canvasId: string, type: CanvasNodeType, x: number, y: number, width?: number, height?: number, content?: string, refId?: string, color?: string }`
- **Output**: `{ id, canvasId, type, x, y, width, height, content, refId }`
- **Service**: `canvasNodeService.create(canvasId, data)` → `CanvasNodeItem`. width 기본값: 260, height 기본값: 160
- **Tool Description**: "Add a node to a canvas. Types: text, todo, note, schedule, csv, pdf, image. For reference types (todo, note, etc.), provide refId of the existing item."
- **HTTP**: `POST /api/workspaces/:wsId/canvases/:canvasId/nodes`
- **Broadcast**: `canvas:changed` — paths: `[]`

#### `remove_canvas_node`

- **Input**: `{ workspaceId: string, canvasId: string, nodeId: string }`
- **Output**: `{ success: true }`
- **Service**: `canvasNodeService.remove(nodeId)` → `void`. FK CASCADE로 연결된 edge도 자동 삭제
- **참고**: `nodeId`만으로 동작 — `canvasId`/`wsId`는 URL 일관성용. 해당 node가 canvasId에 속하는지 별도 검증하지 않음 (기존 IPC 패턴과 동일)
- **HTTP**: `DELETE /api/workspaces/:wsId/canvases/:canvasId/nodes/:nodeId`
- **Broadcast**: `canvas:changed` — paths: `[]`

#### `add_canvas_edge`

- **Input**: `{ workspaceId: string, canvasId: string, fromNode: string, toNode: string, fromSide?: string, toSide?: string, label?: string, color?: string, style?: string, arrow?: string }`
- **Output**: `{ id, canvasId, fromNode, toNode, fromSide, toSide, label, style, arrow }`
- **Service**: `canvasEdgeService.create(canvasId, data)` → `CanvasEdgeItem`. 내부 검증: self-loop 불가, 중복 엣지 불가, from/to 노드 존재 확인
- **Tool Description**: "Add an edge connecting two nodes. Sides: top, right, bottom, left. Styles: solid, dashed, dotted. Arrow: none, end, both."
- **HTTP**: `POST /api/workspaces/:wsId/canvases/:canvasId/edges`
- **Broadcast**: `canvas:changed` — paths: `[]`

#### `remove_canvas_edge`

- **Input**: `{ workspaceId: string, canvasId: string, edgeId: string }`
- **Output**: `{ success: true }`
- **Service**: `canvasEdgeService.remove(edgeId)` → `void`
- **참고**: `edgeId`만으로 동작 — `canvasId`/`wsId`는 URL 일관성용
- **HTTP**: `DELETE /api/workspaces/:wsId/canvases/:canvasId/edges/:edgeId`
- **Broadcast**: `canvas:changed` — paths: `[]`

### 6.3 Folder Tools

#### `create_folder`

- **Input**: `{ workspaceId: string, parentFolderId?: string, name: string }`
- **Output**: `{ id, name, relativePath }`
- **Service**: `folderService.create(workspaceId, parentFolderId, name)` → `FolderNode`
- **타입 매핑**: `parentFolderId?: string` → `parentFolderId: string | null` (핸들러에서 `body.parentFolderId ?? null`)
- **HTTP**: `POST /api/workspaces/:wsId/folders`
- **Broadcast**: `folder:changed` — paths: `[result.relativePath]`

#### `rename_folder`

- **Input**: `{ workspaceId: string, folderId: string, newName: string }`
- **Output**: `{ id, name, relativePath }`
- **Service**: `folderService.rename(workspaceId, folderId, newName)` → `FolderNode`
- **참고**: 내부에서 `folderRepository.bulkUpdatePathPrefix` + `noteRepository.bulkUpdatePathPrefix` 호출. csv/pdf/image의 경로 갱신은 watcher에 위임 (섹션 3.4 참고)
- **HTTP**: `PATCH /api/workspaces/:wsId/folders/:folderId/rename`
- **Broadcast**: `folder:changed` paths: `[result.relativePath]` + `note:changed` paths: `[]` + `csv:changed` paths: `[]`

#### `delete_folder`

- **Input**: `{ workspaceId: string, folderId: string }`
- **Output**: `{ success: true }`
- **Service**: `folderRepository.findById(folderId)` (relativePath 캡처) + `folderService.remove(workspaceId, folderId)` → `void`
- **참고**: `fs.rmSync(recursive)` + `folderRepository.bulkDeleteByPrefix` 호출. 하위 note/csv DB 레코드는 직접 삭제하지 않음 — FK `onDelete: 'set null'`로 folderId null 처리 후 watcher/reconciliation이 정리 (섹션 3.5 참고)
- **Tool Description**: "WARNING: This permanently deletes the folder and ALL contents inside it (notes, tables, subfolders). This action cannot be undone."
- **HTTP**: `DELETE /api/workspaces/:wsId/folders/:folderId`
- **Broadcast**: `folder:changed` paths: `[folder.relativePath]` + `note:changed` paths: `[]` + `csv:changed` paths: `[]`

#### `move_folder`

- **Input**: `{ workspaceId: string, folderId: string, parentFolderId?: string }`
- **Output**: `{ id, name, relativePath }`
- **Service**: `folderService.move(workspaceId, folderId, parentFolderId, 0)` → `FolderNode`
- **타입 매핑**: `parentFolderId?: string` → `parentFolderId: string | null` (핸들러에서 `body.parentFolderId ?? null`)
- **참고**: 내부에서 순환 이동 방지 검증. `folderRepository.bulkUpdatePathPrefix` + `noteRepository.bulkUpdatePathPrefix` 호출. csv/pdf/image 경로 갱신은 watcher에 위임
- **HTTP**: `PATCH /api/workspaces/:wsId/folders/:folderId/move`
- **Broadcast**: `folder:changed` paths: `[result.relativePath]` + `note:changed` paths: `[]` + `csv:changed` paths: `[]`

## 7. HTTP API Endpoints (New)

| Method | Path                                                     | Tool               |
| ------ | -------------------------------------------------------- | ------------------ |
| GET    | `/api/workspaces/:wsId/tables`                           | list_tables        |
| GET    | `/api/workspaces/:wsId/tables/:tableId/content`          | read_table         |
| PUT    | `/api/workspaces/:wsId/tables/:tableId/content`          | write_table        |
| POST   | `/api/workspaces/:wsId/tables`                           | create_table       |
| PATCH  | `/api/workspaces/:wsId/tables/:tableId/rename`           | rename_table       |
| DELETE | `/api/workspaces/:wsId/tables/:tableId`                  | delete_table       |
| PATCH  | `/api/workspaces/:wsId/tables/:tableId/move`             | move_table         |
| GET    | `/api/workspaces/:wsId/canvases`                         | list_canvases      |
| GET    | `/api/workspaces/:wsId/canvases/:canvasId`               | read_canvas        |
| POST   | `/api/workspaces/:wsId/canvases`                         | create_canvas      |
| PATCH  | `/api/workspaces/:wsId/canvases/:canvasId`               | update_canvas      |
| DELETE | `/api/workspaces/:wsId/canvases/:canvasId`               | delete_canvas      |
| POST   | `/api/workspaces/:wsId/canvases/:canvasId/nodes`         | add_canvas_node    |
| DELETE | `/api/workspaces/:wsId/canvases/:canvasId/nodes/:nodeId` | remove_canvas_node |
| POST   | `/api/workspaces/:wsId/canvases/:canvasId/edges`         | add_canvas_edge    |
| DELETE | `/api/workspaces/:wsId/canvases/:canvasId/edges/:edgeId` | remove_canvas_edge |
| POST   | `/api/workspaces/:wsId/folders`                          | create_folder      |
| PATCH  | `/api/workspaces/:wsId/folders/:folderId/rename`         | rename_folder      |
| DELETE | `/api/workspaces/:wsId/folders/:folderId`                | delete_folder      |
| PATCH  | `/api/workspaces/:wsId/folders/:folderId/move`           | move_folder        |

## 8. File Structure (변경사항)

```
src/main/mcp-api/routes/
  folder.ts              <- 기존 GET만 있음 → POST, PATCH, DELETE 추가
  csv.ts                 <- 신규
  canvas.ts              <- 신규
  index.ts               <- registerCsvRoutes, registerCanvasRoutes 추가

src/preload/
  index.ts               <- canvas 객체에 onChanged 리스너 추가
  index.d.ts             <- CanvasAPI 인터페이스에 onChanged 타입 추가

src/renderer/src/entities/canvas/model/
  use-canvas-watcher.ts  <- 신규: canvas:changed 구독 + invalidation

src/renderer/src/app/layout/
  MainLayout.tsx         <- useCanvasWatcher() 호출 추가

src/mcp-server/
  tool-definitions.ts    <- 새 도구 20개 추가
```

## 9. Implementation Strategy

### 구현 순서

1. **Canvas push 채널 구현** — preload에 `canvas.onChanged` 추가, renderer에 `useCanvasWatcher` 추가, MainLayout에서 호출
2. **HTTP API: Table(CSV) 라우트** — `src/main/mcp-api/routes/csv.ts` 생성, 7개 엔드포인트
3. **HTTP API: Canvas 라우트** — `src/main/mcp-api/routes/canvas.ts` 생성, 8개 엔드포인트
4. **HTTP API: Folder 라우트 확장** — 기존 `folder.ts`에 POST/PATCH/DELETE 추가
5. **라우트 등록** — `routes/index.ts`에 새 라우트 등록 (URL 매칭 순서 주의)
6. **MCP Tool 추가** — `tool-definitions.ts`에 20개 도구 정의
7. **MCP 서버 재빌드** — tsup 빌드
8. **수동 테스트** — Claude Code에서 새 도구 호출 검증

## 10. Risks

| #    | Risk                                                                                                                          | Impact | Mitigation                                                                                                                                                                                       | Status        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| R-1  | Folder 삭제 시 하위 전체 삭제 — AI 실수                                                                                       | 높음   | Tool description에 WARNING 명시                                                                                                                                                                  | Open          |
| R-2  | Canvas 삭제 시 node/edge 전체 삭제                                                                                            | 중간   | Tool description에 WARNING 명시                                                                                                                                                                  | Open          |
| R-3  | CSV write 시 기존 데이터 유실                                                                                                 | 중간   | 전체 content 교체 방식이므로 read 후 수정 권장 명시                                                                                                                                              | Open          |
| R-4  | Canvas에 push 채널 없음 → MCP 변경 시 renderer 미반영                                                                         | 높음   | `canvas:changed` 채널 신규 구현 (preload + renderer watcher)                                                                                                                                     | **해결 필요** |
| R-5  | Tool 수 증가로 AI 혼란 (9 → 29개)                                                                                             | 낮음   | 명확한 naming convention (list/read/write/create/rename/delete/move)                                                                                                                             | Open          |
| R-6  | Folder rename/move 시 하위 note/csv 경로도 변경됨                                                                             | 중간   | 다중 채널 broadcast (`folder:changed` + `note:changed` + `csv:changed`)                                                                                                                          | Open          |
| R-7  | DELETE 메서드 body 파싱 문제                                                                                                  | 낮음   | `parseBody`가 size=0이면 null 반환 확인 완료                                                                                                                                                     | **해결됨**    |
| R-8  | CSV broadcast 시 `changedRelPaths` 누락 시 외부 변경 토스트 미표시                                                            | 낮음   | `useFileWatcher`가 경로 매칭으로 동작하므로 올바른 relativePath 전달 필수                                                                                                                        | Open          |
| R-9  | Folder rename이 `noteRepository.bulkUpdatePathPrefix`도 호출 → note 경로 변경                                                 | 중간   | 다중 채널 broadcast + 경로는 빈 배열(`[]`)로 전달하여 목록 전체 invalidation                                                                                                                     | Open          |
| R-10 | `folderService.rename/move`에서 `csvFileRepository.bulkUpdatePathPrefix` 미호출 — CSV 경로 미갱신                             | 중간   | 활성 ws: watcher가 처리. 비활성 ws: 전환 시 `fullReconciliation`으로 복구. MCP에서는 빈 배열 broadcast로 목록 invalidation                                                                       | **수용**      |
| R-11 | Canvas watcher 추가로 기존 Canvas IPC mutation과 이중 invalidation                                                            | 낮음   | 이중 invalidation은 re-fetch만 발생, 부작용 없음 (note watcher와 동일 패턴)                                                                                                                      | **수용**      |
| R-12 | `folderService.remove()`가 하위 note/csv/pdf/image DB를 직접 삭제하지 않음 — FK `onDelete: 'set null'`로 folderId만 null 처리 | 중간   | 활성 ws: watcher가 FS delete 이벤트로 정리. 비활성 ws: 전환 시 reconciliation으로 정리. **기존 앱과 동일한 동작** — MCP 고유 문제 아님                                                           | **수용**      |
| R-13 | CSV write_table broadcast 시 paths에 relativePath 누락하면 열려있는 탭의 content가 stale                                      | 중간   | `useFileWatcher`가 paths 기반으로 content refetch하므로, write 시 반드시 `[csv.relativePath]` 전달 필수                                                                                          | Open          |
| R-14 | MCP 변경 시 "외부에서 파일/폴더가 변경되었습니다" 토스트 표시                                                                 | 낮음   | `markWorkspaceOwnWrite()`는 renderer IPC mutation에서만 호출. MCP 변경은 HTTP API 경유하므로 "외부 변경"으로 인식됨. MCP가 실제로 외부 변경이므로 의도적 동작으로 **수용**                       | **수용**      |
| R-15 | `canvasService.findById(canvasId)` — wsId 미검증, 다른 ws의 canvas 접근 가능                                                  | 낮음   | 기존 IPC 핸들러도 동일 패턴 (canvasId만으로 조회). `canvasNodeService.remove(nodeId)`, `canvasEdgeService.remove(edgeId)`도 동일. MCP에서 AI가 ID를 혼동할 수 있으나, 기존 앱과 동일한 보안 수준 | **수용**      |
| R-16 | `canvasGroups` 스키마 존재하나 service/repository 미구현                                                                      | 낮음   | DB 스키마(`src/main/db/schema/canvas-group.ts`)만 존재. 기능 미구현 상태이므로 MCP에서도 제외 — Out of Scope                                                                                     | **해당없음**  |

## 11. Success Criteria

| #    | Criteria                                                             |
| ---- | -------------------------------------------------------------------- |
| SC-1 | Claude Code에서 CSV 목록 조회/읽기/쓰기/생성/이름변경/삭제/이동 가능 |
| SC-2 | Claude Code에서 캔버스 목록/상세 조회/생성/수정/삭제 가능            |
| SC-3 | Claude Code에서 캔버스 노드/엣지 추가/제거 가능                      |
| SC-4 | Claude Code에서 폴더 생성/이름변경/삭제/이동 가능                    |
| SC-5 | 모든 변경 작업 후 Rally 화면에 즉시 반영                             |
| SC-6 | 기존 note 관련 9개 도구 정상 동작 유지                               |
| SC-7 | 기존 Rally 기능에 영향 없음                                          |

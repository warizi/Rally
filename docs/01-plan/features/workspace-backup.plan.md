# Workspace Backup Plan

> **Feature**: workspace-backup
> **Date**: 2026-03-08
> **Status**: Draft (Revised v4)

---

## 1. Overview

워크스페이스 단위 백업/복구 기능. 현재 워크스페이스의 DB 데이터 + root 폴더 파일들을 ZIP으로 내보내고, 새 워크스페이스 생성 시 백업 파일을 업로드하여 완벽하게 복구한다.

### 1.1 목표

- 워크스페이스 데이터(DB) + 파일시스템(root 폴더)을 하나의 ZIP으로 내보내기
- 새 워크스페이스 생성 시 백업 ZIP을 업로드하면 데이터 + 파일이 완벽 복구
- 앱 설정(`app_settings`)은 복구 대상에서 제외

### 1.2 적용 범위

| 영역     | 범위                                             |
| -------- | ------------------------------------------------ |
| Backend  | backup export/import service, IPC handlers       |
| Frontend | CreateWorkspaceDialog에 복구 파일 업로드 UI 추가 |
| 파일     | ZIP 압축/해제 (Node.js archiver or yazl/yauzl)   |

---

## 2. 백업 스코프

### 2.1 DB 테이블 (워크스페이스 단위)

#### Level 1: workspaceId 직접 FK — 직접 쿼리 가능

| 테이블        | 쿼리 방법                                                                                  | 비고                                                |
| ------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| workspaces    | PK로 조회                                                                                  | name만 백업 (path는 복구 시 새로 지정)              |
| folders       | `folderRepository.findByWorkspaceId(wid)`                                                  | relativePath, color, order                          |
| notes         | `noteRepository.findByWorkspaceId(wid)`                                                    | via createFileRepository 팩토리                     |
| csv_files     | `csvFileRepository.findByWorkspaceId(wid)`                                                 | via createFileRepository 팩토리                     |
| pdf_files     | `pdfFileRepository.findByWorkspaceId(wid)`                                                 | via createFileRepository 팩토리                     |
| image_files   | `imageFileRepository.findByWorkspaceId(wid)`                                               | via createFileRepository 팩토리                     |
| todos         | `todoRepository.findByWorkspaceId(wid)`                                                    | parentId 자기참조 포함                              |
| schedules     | `scheduleRepository.findAllByWorkspaceId(wid)`                                             |                                                     |
| entity_links  | raw Drizzle: `db.select().from(entityLinks).where(eq(entityLinks.workspaceId, wid)).all()` | repository에 findByWorkspaceId 없음 — raw 쿼리 필요 |
| canvases      | `canvasRepository.findByWorkspaceId(wid)`                                                  |                                                     |
| tags          | `tagRepository.findByWorkspaceId(wid)`                                                     |                                                     |
| tab_sessions  | `tabSessionRepository.findTabSessionByWorkspaceId(wid)`                                    | 워크스페이스당 1개 (unique)                         |
| tab_snapshots | `tabSnapshotRepository.findByWorkspaceId(wid)`                                             |                                                     |

#### Level 2: 부모 ID를 통해 조회 (workspaceId 직접 없음)

| 테이블         | 부모            | 쿼리 방법                                                                                  | 비고                                                                                         |
| -------------- | --------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| canvas_nodes   | canvases        | `canvasNodeRepository.findByCanvasId(canvasId)` per canvas                                 |                                                                                              |
| canvas_edges   | canvases        | `canvasEdgeRepository.findByCanvasId(canvasId)` per canvas                                 |                                                                                              |
| canvas_groups  | canvases        | repository 없음 — raw Drizzle 쿼리 필요                                                    | `db.select().from(canvasGroups).where(eq(canvasGroups.canvasId, id))`                        |
| schedule_todos | schedules       | `scheduleTodoRepository.findTodosByScheduleId(sid)`                                        | 주의: 이 메서드는 todos를 JOIN해서 반환 — 원시 junction 레코드(scheduleId, todoId) 추출 필요 |
| item_tags      | tags            | `itemTagRepository.findByTag(tagId)` per tag                                               |                                                                                              |
| reminders      | todos/schedules | `reminderRepository.findByEntity('todo', todoId)` + `findByEntity('schedule', scheduleId)` | workspaceId FK 없음 — entityType+entityId로 조회                                             |

### 2.2 제외 대상

| 테이블       | 이유                                   |
| ------------ | -------------------------------------- |
| app_settings | 앱 전역 설정, 워크스페이스 스코프 아님 |

### 2.3 파일시스템

- `workspace.path` (root 폴더) 하위 **모든** 파일/디렉토리
- 노트 콘텐츠: `.md` 파일 (DB에는 preview 200자만 저장, 실제 내용은 파일)
- CSV 콘텐츠: `.csv` 파일 (DB에는 preview 3행만 저장, 실제 내용은 파일)
- PDF: `.pdf` 바이너리 파일 (DB에는 메타데이터만)
- 이미지: 사용자 이미지 파일 (DB에는 메타데이터만)
- **`.images/` 숨김 디렉토리**: 노트에 임베드된 이미지 저장소 (`{nanoid}.{ext}`)
  - `image_files` 테이블에 등록되지 않음 (노트 내부 에셋)
  - 노트 마크다운에서 `![](경로)`로 참조
  - **반드시 백업에 포함해야 노트 이미지가 복구됨**

### 2.4 데이터 저장 위치 정리

| 데이터                              | 파일시스템           | DB                           |
| ----------------------------------- | -------------------- | ---------------------------- |
| 노트 내용                           | .md 파일 (원본)      | preview 200자만              |
| CSV 내용                            | .csv 파일 (원본)     | preview 3행만 + columnWidths |
| PDF 내용                            | .pdf 바이너리 (원본) | 메타데이터만                 |
| 이미지 내용                         | 이미지 파일 (원본)   | 메타데이터만                 |
| 노트 임베드 이미지                  | `.images/` 디렉토리  | 없음 (DB 미등록)             |
| 할일/일정/캔버스/태그/링크/리마인더 | 없음                 | DB만                         |
| 탭 세션/스냅샷                      | 없음                 | DB만 (JSON 문자열)           |

---

## 3. ZIP 구조

```
rally-backup-{workspaceName}-{timestamp}.zip
├── manifest.json
├── data/
│   ├── workspace.json
│   ├── folders.json
│   ├── notes.json
│   ├── csv-files.json
│   ├── pdf-files.json
│   ├── image-files.json
│   ├── todos.json
│   ├── schedules.json
│   ├── schedule-todos.json
│   ├── entity-links.json
│   ├── canvases.json
│   ├── canvas-nodes.json
│   ├── canvas-edges.json
│   ├── canvas-groups.json
│   ├── tags.json
│   ├── item-tags.json
│   ├── tab-sessions.json
│   ├── tab-snapshots.json
│   └── reminders.json
└── files/                     ← workspace.path 전체 복사
    ├── .images/               ← 노트 임베드 이미지 (필수)
    │   ├── abc123.png
    │   └── def456.jpg
    ├── folder1/
    │   ├── note1.md
    │   └── image1.png
    ├── note2.md
    └── data.csv
```

### 3.1 manifest.json

```json
{
  "version": 1,
  "appVersion": "x.x.x",
  "workspaceName": "My Workspace",
  "exportedAt": "2026-03-08T12:00:00.000Z",
  "tables": ["folders", "notes", "todos", "..."]
}
```

---

## 4. Backend 구현

### 4.1 Export (내보내기)

**services/backup.ts** — `backupService`

- `export(workspaceId: string, savePath: string): Promise<void>`
  1. `dialog.showSaveDialog()`는 IPC handler에서 먼저 호출 → savePath 전달
  2. `workspaceService.getById(workspaceId)` → 워크스페이스 조회
  3. **Level 1 쿼리**: workspaceId 직접 FK 테이블 전부 조회
  4. **Level 2 쿼리**: 부모 ID 기반 하위 테이블 조회
     ```
     canvases → canvas_nodes, canvas_edges, canvas_groups (per canvasId)
     schedules → schedule_todos (per scheduleId)
     tags → item_tags (per tagId)
     todos + schedules → reminders (per entityType + entityId)
     ```
  5. **timestamp 직렬화**: Drizzle ORM이 `timestamp_ms` 컬럼을 Date 객체로 반환하므로,
     JSON 저장 전 Date → number(ms) 변환 필수 (JSON.stringify는 Date를 ISO 문자열로 변환하여 import 시 타입 불일치 발생)
     ```typescript
     // replacer로 Date → number 변환
     JSON.stringify(data, (key, value) => (value instanceof Date ? value.getTime() : value))
     ```
  6. 임시 디렉토리에 manifest.json + data/\*.json 작성
  7. files/ 에 `workspace.path` 하위 전체 복사 (`.images/` 포함)
  8. ZIP 압축 → savePath에 저장
  9. 임시 디렉토리 정리

### 4.2 Import (복구)

**services/backup.ts** — `backupService`

- `import(zipPath: string, newName: string, newPath: string): Promise<Workspace>`
  1. ZIP 해제 → 임시 디렉토리
  2. manifest.json version 호환성 검증
  3. **files/ 디렉토리 → newPath로 복사** (파일 먼저 복사)
  4. **DB 트랜잭션 시작** (실패 시 전체 롤백)
  5. 새 워크스페이스 생성 (nanoid, newName, newPath)
  6. **timestamp 역변환**: JSON에서 읽은 number 값을 `new Date(ms)`로 변환하여 Drizzle insert에 전달
  7. ID 매핑 + 테이블 삽입 (순서 중요 — 섹션 4.3 참조)
  8. **DB 트랜잭션 커밋**
  9. 임시 디렉토리 정리
  10. 생성된 워크스페이스 반환

**주의: Workspace Watcher 충돌 방지**

- import는 워크스페이스 생성만 하고 `workspace:activate`는 호출하지 않음
- watcher는 activate 시 시작되므로, import 중 파일 감지 충돌 없음
- import 완료 후 renderer에서 activate → watcher 시작 → DB에 이미 데이터 있으므로 reconcile 시 중복 생성 안 됨 (relativePath unique constraint)

**에러 롤백**:

- DB 트랜잭션 실패 시: 자동 롤백 + 생성된 워크스페이스 삭제
- 파일 복사 후 DB 실패 시: 복사된 파일 정리 (rm -rf newPath 내 복사 파일)

### 4.3 ID 매핑 전략

**모든 엔티티에 새 nanoid 발급 + 매핑 테이블 유지**

같은 백업을 두 번 복구할 경우 PK 충돌 방지를 위해 새 ID 필수.

```typescript
// 통합 ID 매핑
const idMap = new Map<string, string>() // oldId → newId

// 엔티티 타입별 매핑 조회 헬퍼
function mapId(oldId: string): string {
  const newId = idMap.get(oldId)
  if (!newId) throw new Error(`ID mapping not found: ${oldId}`)
  return newId
}

// nullable FK용 헬퍼 (folderId, parentId, refId, activeTabId 등)
function mapIdOrNull(oldId: string | null): string | null {
  return oldId != null ? mapId(oldId) : null
}

// 엔티티 타입 기반 동적 매핑 (entity_links, canvas_nodes.refId, item_tags.itemId, reminders.entityId)
function mapEntityId(entityType: string, oldId: string): string {
  return mapId(oldId) // 모든 엔티티 ID가 단일 idMap에 있으므로 타입 무관하게 조회 가능
}

// 고아 참조 안전 매핑 (entity_links, item_tags, reminders용)
// 삭제된 엔티티를 참조하는 레코드는 skip (mapIdOrSkip 반환 null → 해당 레코드 제외)
function mapIdOrSkip(oldId: string): string | null {
  return idMap.get(oldId) ?? null
}
```

### 4.4 테이블 삽입 순서 (FK 의존성)

```
1.  folders         → workspaceId 교체, id 매핑 등록
                       ※ path depth 순 정렬 (얕은 것 먼저: "a" → "a/b" → "a/b/c")
                       ※ 계층 구조가 parentId가 아닌 relativePath 기반이므로
                         FK 의존은 없지만, 디스크 디렉토리 생성 순서와 일치시킴
2.  notes           → workspaceId, folderId 교체 (mapIdOrNull — nullable!), id 매핑 등록
3.  csv_files       → workspaceId, folderId 교체, id 매핑 등록
4.  pdf_files       → workspaceId, folderId 교체, id 매핑 등록
5.  image_files     → workspaceId, folderId 교체, id 매핑 등록
6.  todos           → workspaceId, parentId 교체 (mapIdOrNull — nullable!), id 매핑 등록
                       ※ topological sort 필수 (parentId=null 먼저)
7.  schedules       → workspaceId 교체, id 매핑 등록
8.  schedule_todos  → scheduleId, todoId 교체 (매핑 조회)
9.  canvases        → workspaceId 교체, id 매핑 등록
10. canvas_nodes    → canvasId 교체, refId를 type 기반 매핑 (mapIdOrNull — nullable!), id 매핑 등록
11. canvas_edges    → canvasId, fromNode, toNode 교체 (매핑 조회)
12. canvas_groups   → canvasId 교체, id 매핑 등록
13. entity_links    → workspaceId, sourceId, targetId 교체 (mapIdOrSkip — 고아 참조 시 skip)
                       ※ 별도 id 컬럼 없음 — composite PK (sourceType, sourceId, targetType, targetId)
                       ※ 이미 정규화된 형태로 저장됨 (sourceType <= targetType)
                       ※ raw insert 시 정규화 유지 필수 (service 우회이므로 재정규화 안 됨)
                       ※ sourceId/targetId 중 하나라도 매핑 실패 시 해당 레코드 skip
14. tags            → workspaceId 교체, id 매핑 등록
15. item_tags       → tagId, itemId(itemType기반) 교체 (mapIdOrSkip — 고아 참조 시 skip), id 매핑 등록
16. reminders       → entityId(entityType기반) 교체 (mapIdOrSkip — 고아 참조 시 skip), id 매핑 등록
17. tab_sessions    → id 제외 (auto-increment — DB 자동 생성)
                       workspaceId 교체 + activePaneId 매핑 (별도 컬럼!)
                       + JSON 내부 ID 매핑 (섹션 4.5)
                       upsert 패턴 사용 (workspaceId가 실질적 PK)
18. tab_snapshots   → id 매핑 등록 (nanoid), workspaceId 교체
                       + JSON 내부 ID 매핑 (섹션 4.5)
                       ※ activePaneId 컬럼 없음 — 복구 시 panesJson의 첫 번째 pane.id 사용
```

### 4.5 tab_sessions / tab_snapshots JSON 내부 ID 매핑 (상세)

이 테이블들은 3개의 JSON 문자열 컬럼을 가지며, 내부에 엔티티 ID가 포함된다.

#### tabsJson 구조: `Record<string, SerializedTab>`

```typescript
interface SerializedTab {
  id: string // pathname 기반 고유 ID (예: "tab-folder-note-abc123")
  type: TabType // 'dashboard' | 'todo' | 'todo-detail' | 'folder' |
  // 'note' | 'csv' | 'pdf' | 'image' | 'calendar' |
  // 'canvas' | 'canvas-detail' | 'terminal'
  title: string
  pathname: string // 라우트 경로 (예: "/folder/note/:noteId")
  searchParams?: Record<string, string> // 쿼리 파라미터 (tagId 등)
  pinned: boolean
  createdAt: number
  lastAccessedAt: number
  error?: boolean
}
```

**매핑이 필요한 필드:**

| TabType         | pathname 패턴                                                         | 추출할 ID | 매핑              |
| --------------- | --------------------------------------------------------------------- | --------- | ----------------- |
| `todo-detail`   | `/todo/:todoId`                                                       | todoId    | `mapId(todoId)`   |
| `note`          | `/folder/note/:noteId`                                                | noteId    | `mapId(noteId)`   |
| `csv`           | `/folder/csv/:csvId`                                                  | csvId     | `mapId(csvId)`    |
| `pdf`           | `/folder/pdf/:pdfId`                                                  | pdfId     | `mapId(pdfId)`    |
| `image`         | `/folder/image/:imageId`                                              | imageId   | `mapId(imageId)`  |
| `canvas-detail` | `/canvas/:canvasId`                                                   | canvasId  | `mapId(canvasId)` |
| 그 외           | `/dashboard`, `/todo`, `/folder`, `/calendar`, `/canvas`, `/terminal` | 없음      | 매핑 불필요       |

**매핑 절차:**

1. pathname에서 마지막 세그먼트(엔티티 ID) 추출
2. `mapId()`로 새 ID 조회
3. pathname 재구성 (ID 부분만 교체)
4. **tab.id 재생성** — `createTabId(pathname)` 함수로 결정적 생성:
   ```typescript
   // src/renderer/src/features/tap-system/manage-tab-system/lib/factory.ts
   function createTabId(pathname: string): string {
     return `tab-${pathname
       .replace(/[^a-zA-Z0-9]/g, '-')
       .replace(/-+/g, '-')
       .replace(/^-|-$/g, '')}`
   }
   // 예: "/folder/note/abc123" → "tab-folder-note-abc123"
   ```
   새 pathname으로 `createTabId()`를 호출하면 새 tab.id가 결정적으로 생성됨
5. searchParams 내 ID 매핑:
   - **`folderOpenState`**: JSON 문자열로 `Record<folderId, boolean>` — key가 folder ID
     → JSON 파싱 → key를 `mapId(oldFolderId)`로 교체 → JSON 직렬화
   - 그 외 searchParams (viewType, currentDate, status, priority, view 등)는 UI 상태값이므로 매핑 불필요

#### panesJson 구조: `Record<string, Pane>`

```typescript
interface Pane {
  id: string // nanoid (매핑 불필요 — 새로 생성해도 무방)
  tabIds: string[] // SerializedTab.id 참조 → 위에서 재생성된 tab.id로 교체
  activeTabId: string | null // SerializedTab.id 참조 → 교체
  size: number
  minSize: number
}
```

#### layoutJson 구조: `LayoutNode` (재귀)

```typescript
type LayoutNode = PaneNode | SplitNode

interface PaneNode {
  id: string // nanoid (매핑 불필요)
  type: 'pane'
  paneId: string // Pane.id 참조 → 교체
}

interface SplitNode {
  id: string
  type: 'split'
  direction: 'horizontal' | 'vertical'
  children: LayoutNode[] // 재귀
  sizes: number[]
}
```

**전체 매핑 흐름:**

```
1. tabsJson 파싱 (Record<tabId, SerializedTab>)
   → 각 tab의 pathname에서 엔티티 ID 추출 + 매핑
   → 새 pathname 생성 → createTabId(newPathname)으로 새 tab.id 생성
   → oldTabId → newTabId 매핑 테이블 별도 유지
   → searchParams 내 folderOpenState의 folder ID key도 매핑
   → ※ 매핑 실패 시 (삭제된 엔티티 참조 탭): 해당 탭 제거
   → ※ Record KEY도 새 tab.id로 교체 필수!
      (tabsJson의 key와 value.id가 반드시 일치해야 함)

2. panesJson 파싱 (Record<paneId, Pane>)
   → 각 pane에 새 nanoid 발급
   → tabIds, activeTabId를 oldTabId→newTabId로 교체
   → 1단계에서 제거된 탭은 tabIds에서도 제거
   → oldPaneId → newPaneId 매핑 별도 유지
   → ※ Record KEY도 새 pane.id로 교체 필수!
      (panesJson의 key와 value.id가 반드시 일치해야 함)

3. layoutJson 파싱 → PaneNode.paneId를 oldPaneId→newPaneId로 교체
   → 재귀적으로 처리

4. tab_sessions의 activePaneId (별도 컬럼!) 를 oldPaneId→newPaneId로 교체

5. 각각 JSON.stringify로 직렬화하여 DB에 저장
```

**매핑 실패 처리 (삭제된 엔티티를 참조하는 탭):**

- 탭 세션에는 이미 삭제된 엔티티를 참조하는 탭이 `error: true` 상태로 남아있을 수 있음
- 이런 탭의 pathname에서 추출한 엔티티 ID는 idMap에 존재하지 않음
- **전략**: 매핑 실패한 탭은 복구에서 제거 (error 탭은 어차피 사용 불가)
- 제거 후 빈 pane이 생기면 해당 pane도 제거, layout 재구성

#### tab_sessions.activePaneId (별도 컬럼)

- `activePaneId`는 JSON 내부가 아닌 **독립된 DB 컬럼**
- panesJson의 Pane.id를 참조하므로, pane ID 매핑 후 반드시 교체
- tab_snapshots에는 이 컬럼이 **없음**

### 4.6 canvas_nodes.refId 매핑 상세

canvas_nodes는 type에 따라 다른 엔티티를 참조:

| canvas_nodes.type | refId가 참조하는 테이블 |
| ----------------- | ----------------------- |
| `text`            | null (refId 없음)       |
| `todo`            | todos.id                |
| `note`            | notes.id                |
| `schedule`        | schedules.id            |
| `csv`             | csv_files.id            |
| `pdf`             | pdf_files.id            |
| `image`           | image_files.id          |

→ `refId`가 null이 아니면 `mapId(refId)`로 교체

### 4.7 IPC Handlers

**ipc/backup.ts** — `registerBackupHandlers()`

**주의: `handle()` 래퍼는 동기 전용** — backup export/import는 비동기(async)이므로 `handle()` 사용 불가.
직접 try/catch로 `IpcResponse`를 구성하거나, `handleAsync()` 유틸을 새로 만들어야 함.

```typescript
// async용 handle 유틸 (신규 — src/main/lib/handle.ts에 추가)
async function handleAsync<T>(fn: () => Promise<T>): Promise<IpcResponse<T>> {
  try {
    return successResponse(await fn())
  } catch (e) {
    return errorResponse(e)
  }
}

// 내보내기: dialog 먼저 → 경로 확정 후 export
ipcMain.handle('backup:export', async (_, workspaceId: string) => {
  const ws = workspaceService.getById(workspaceId)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: `rally-backup-${ws.name}-${timestamp}.zip`,
    filters: [{ name: 'ZIP', extensions: ['zip'] }]
  })
  if (canceled || !filePath) return successResponse(null)
  return handleAsync(() => backupService.export(workspaceId, filePath))
})

// 복구용 ZIP 파일 선택
ipcMain.handle('backup:selectFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Rally Backup', extensions: ['zip'] }],
    properties: ['openFile']
  })
  return canceled ? null : filePaths[0]
})

// manifest 읽기 (ZIP 선택 후 이름 자동 채움용)
ipcMain.handle('backup:readManifest', (_, zipPath: string) =>
  handle(() => backupService.readManifest(zipPath))
)

// 복구 (async)
ipcMain.handle('backup:import', async (_, zipPath: string, name: string, path: string) =>
  handleAsync(() => backupService.import(zipPath, name, path))
)
```

### 4.8 Preload Bridge

```typescript
backup: {
  export: (workspaceId: string) =>
    ipcRenderer.invoke('backup:export', workspaceId),
  selectFile: () =>
    ipcRenderer.invoke('backup:selectFile'),
  readManifest: (zipPath: string) =>
    ipcRenderer.invoke('backup:readManifest', zipPath),
  import: (zipPath: string, name: string, path: string) =>
    ipcRenderer.invoke('backup:import', zipPath, name, path),
}
```

**preload/index.d.ts:**

```typescript
interface BackupManifest {
  version: number
  appVersion: string
  workspaceName: string
  exportedAt: string
  tables: string[]
}

interface BackupAPI {
  export: (workspaceId: string) => Promise<IpcResponse<null>>
  selectFile: () => Promise<string | null>
  readManifest: (zipPath: string) => Promise<IpcResponse<BackupManifest>>
  import: (zipPath: string, name: string, path: string) => Promise<IpcResponse<Workspace>>
}
```

---

## 5. Frontend 구현

### 5.1 내보내기 (Export)

진입점: WorkspaceSwitcher의 워크스페이스 항목 컨텍스트 메뉴

- "백업 내보내기" 메뉴 아이템 추가
- 클릭 시 `window.api.backup.export(workspaceId)` 호출
- main process에서 dialog.showSaveDialog 처리
- toast로 시작/완료/에러 표시

### 5.2 복구 (Import) — CreateWorkspaceDialog 수정

기존 CreateWorkspaceDialog에 복구 파일 업로드 영역 추가:

```
┌─────────────────────────────────────┐
│ 워크스페이스 추가                    │
│                                     │
│ [이름]  ___________________         │
│ [경로]  _________________  [선택]   │
│                                     │
│ ─── 또는 백업에서 복구 ───          │
│                                     │
│ [복구 파일]  ____________  [선택]   │
│                                     │
│ ※ 백업 파일 선택 시 이름은          │
│   백업에서 자동 입력됩니다          │
│                                     │
│              [취소]  [생성]          │
└─────────────────────────────────────┘
```

**동작 흐름:**

1. "선택" 클릭 → `window.api.backup.selectFile()` → ZIP 경로 반환
2. ZIP 경로로 `window.api.backup.readManifest(zipPath)` → manifest 반환
3. manifest.workspaceName으로 name 필드 자동 채움 (수정 가능)
4. 경로는 사용자가 별도로 선택 (기존 폴더 선택 로직 유지)
5. "생성" 클릭:
   - 복구 파일 있으면 → `window.api.backup.import(zipPath, name, path)`
   - 복구 파일 없으면 → 기존 `workspace.create(name, path)` 로직 유지
6. 성공 시 → `onCreated(workspace.id)` → 워크스페이스 전환 + activate

### 5.3 FSD 레이어 배치

```
features/workspace/
└── switch-workspace/
    └── ui/
        └── CreateWorkspaceDialog.tsx   ← 기존 파일 수정 (복구 UI 추가)

features/workspace/
└── backup-workspace/                   ← 신규
    ├── ui/
    │   └── BackupExportButton.tsx      ← 내보내기 버튼/메뉴 아이템
    └── index.ts
```

### 5.4 React Query

```typescript
const useExportBackup = () =>
  useMutation({
    mutationFn: (workspaceId: string) => window.api.backup.export(workspaceId)
  })

const useImportBackup = () =>
  useMutation({
    mutationFn: (params: { zipPath: string; name: string; path: string }) =>
      window.api.backup.import(params.zipPath, params.name, params.path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
    }
  })
```

---

## 6. 구현 순서

1. **ZIP 라이브러리 설치** — archiver(export) + yauzl(import) 또는 adm-zip(양방향)
2. **services/backup.ts — export** (DB 쿼리 Level 1 + Level 2 + 파일 수집 + ZIP)
3. **services/backup.ts — import** (ZIP 해제 + ID 매핑 + 트랜잭션 DB 삽입 + 파일 복사)
4. **services/backup.ts — readManifest** (ZIP에서 manifest.json만 읽기)
5. **ipc/backup.ts + preload** — 핸들러 등록 + 브리지 + 타입 정의
6. **Frontend — CreateWorkspaceDialog** 수정 (복구 파일 UI + readManifest)
7. **Frontend — WorkspaceSwitcher** 에 내보내기 메뉴 추가

---

## 7. 핵심 고려사항

### 7.1 ID 매핑 정확성

모든 FK 참조에 대해 ID 매핑이 누락되면 복구 실패. 매핑이 필요한 전체 목록:

| 대상 테이블    | 매핑 필요 컬럼                                                                               | 매핑 방법                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| folders        | id, workspaceId                                                                              | 새 nanoid, 새 workspaceId                                                                                                |
| notes          | id, workspaceId, folderId                                                                    | 새 nanoid, 새 wid, `mapIdOrNull(folderId)` ← nullable!                                                                   |
| csv_files      | id, workspaceId, folderId                                                                    | 동일 (`mapIdOrNull`)                                                                                                     |
| pdf_files      | id, workspaceId, folderId                                                                    | 동일 (`mapIdOrNull`)                                                                                                     |
| image_files    | id, workspaceId, folderId                                                                    | 동일 (`mapIdOrNull`)                                                                                                     |
| todos          | id, workspaceId, parentId                                                                    | 새 nanoid, 새 wid, `mapIdOrNull(parentId)` ← nullable!                                                                   |
| schedules      | id, workspaceId                                                                              | 새 nanoid, 새 wid                                                                                                        |
| schedule_todos | scheduleId, todoId                                                                           | `mapId()` 양쪽                                                                                                           |
| canvases       | id, workspaceId                                                                              | 새 nanoid, 새 wid                                                                                                        |
| canvas_nodes   | id, canvasId, refId                                                                          | 새 nanoid, `mapId(canvasId)`, type기반 `mapIdOrNull(refId)` ← nullable (type=text일 때 null)                             |
| canvas_edges   | id, canvasId, fromNode, toNode                                                               | 새 nanoid, `mapId()` 전부                                                                                                |
| canvas_groups  | id, canvasId                                                                                 | 새 nanoid, `mapId(canvasId)`                                                                                             |
| entity_links   | ~~id~~ (없음, composite PK), workspaceId, sourceId, targetId                                 | 새 wid, `mapIdOrSkip(sourceId)`, `mapIdOrSkip(targetId)` — 양쪽 모두 성공해야 삽입, 하나라도 null이면 skip (고아 참조)   |
| tags           | id, workspaceId                                                                              | 새 nanoid, 새 wid                                                                                                        |
| item_tags      | id, tagId, itemId                                                                            | 새 nanoid, `mapId(tagId)`, itemType기반 `mapIdOrSkip(itemId)` — itemId 매핑 실패 시 skip (고아 참조)                     |
| reminders      | id, entityId                                                                                 | 새 nanoid, entityType기반 `mapIdOrSkip(entityId)` — entityId 매핑 실패 시 skip (고아 참조)                               |
| tab_sessions   | ~~id~~ (auto-increment, 매핑 제외) + workspaceId + **activePaneId (별도 컬럼!)** + JSON 내부 | id 미포함(자동 생성), 새 wid, activePaneId=`oldPaneId→newPaneId` + pathname/tabId/paneId/folderOpenState 매핑 (섹션 4.5) |
| tab_snapshots  | id, workspaceId + JSON 내부                                                                  | 새 nanoid, 새 wid + 동일 JSON 매핑                                                                                       |

### 7.2 todos 자기참조 (parentId)

- **topological sort 필수**: parentId가 null인 것 먼저 삽입
- 그 다음 parentId가 이미 삽입된 ID를 참조하는 것 삽입
- 재귀적으로 처리 (깊이 제한 없음)

```typescript
function sortTodosByParent(todos: Todo[]): Todo[] {
  const sorted: Todo[] = []
  const remaining = [...todos]
  const inserted = new Set<string>()

  // parentId가 null인 것 먼저
  // 그 다음 parentId가 inserted에 있는 것 반복
  while (remaining.length > 0) {
    const batch = remaining.filter((t) => t.parentId === null || inserted.has(t.parentId))
    if (batch.length === 0) break // 순환 참조 방지
    batch.forEach((t) => {
      inserted.add(t.id)
      sorted.push(t)
    })
    remaining.splice(0, remaining.length, ...remaining.filter((t) => !inserted.has(t.id)))
  }
  return sorted
}
```

### 7.3 Workspace Watcher 충돌 방지

- `backupService.import()`는 DB에 워크스페이스만 생성, activate하지 않음
- watcher는 `workspace:activate` IPC가 호출될 때 시작됨
- **import 순서**: 파일 복사 → DB 삽입 → (import 완료) → renderer에서 activate → watcher 시작
- watcher 시작 시 reconcile이 실행되지만 안전함:
  1. `reconcileFileType()`은 DB에서 기존 레코드 조회 → `dbPathSet` 구성
  2. 파일시스템 스캔 결과에서 `dbPathSet`에 이미 있는 것은 `toInsert`에서 제외
  3. 만약 어떤 이유로 삽입 시도되더라도 `createMany()`의 `.onConflictDoNothing()`이 안전하게 무시
  4. 고로 기존 메타데이터(title, description, order 등)가 덮어씌워지지 않고 보존됨

### 7.4 canvas_groups repository 부재

- `canvas_groups` 테이블은 스키마만 존재하고 repository가 없음
- export 시: raw Drizzle 쿼리로 조회
  ```typescript
  db.select().from(canvasGroups).where(eq(canvasGroups.canvasId, canvasId)).all()
  ```
- import 시: raw Drizzle 쿼리로 삽입
  ```typescript
  db.insert(canvasGroups).values(mappedData).run()
  ```

### 7.5 schedule_todos 원시 레코드 추출

- `scheduleTodoRepository.findTodosByScheduleId()`는 todos를 JOIN해서 반환
- 백업에는 junction 레코드 자체(scheduleId, todoId 쌍)가 필요
- raw Drizzle 쿼리로 조회:
  ```typescript
  db.select().from(scheduleTodos).where(eq(scheduleTodos.scheduleId, sid)).all()
  ```

### 7.6 파일시스템 복구

- workspace.path가 이미 존재하는 디렉토리를 가리킬 수 있음
- 기존 파일과 충돌 시: 덮어쓰기 (백업 파일 우선)
- 심볼릭 링크는 무시 (보안)
- `.images/` 디렉토리 포함 복사 필수 (노트 임베드 이미지)

### 7.7 대용량 워크스페이스

- 파일이 많거나 큰 경우 ZIP 생성/해제에 시간 소요
- 스트리밍 방식으로 ZIP 처리 (archiver는 스트리밍 지원)
- 진행률 콜백은 v1에서는 미지원 (toast로 시작/완료만 표시)

### 7.8 DB 트랜잭션

- 모든 DB 삽입은 단일 트랜잭션으로 감싸야 함
- better-sqlite3 네이티브 transaction API 사용 (프로젝트 기존 패턴):

  ```typescript
  import { db } from '../db'

  db.$client.transaction(() => {
    // 모든 테이블 삽입 로직
    // 18개 테이블 순서대로 insert
  })() // ← 즉시 실행. 실패 시 자동 롤백
  ```

- batch insert 시 SQLite bind parameter 제한(999)으로 인해 CHUNK=99로 분할:
  ```typescript
  const CHUNK = 99
  for (let i = 0; i < items.length; i += CHUNK) {
    db.insert(table)
      .values(items.slice(i, i + CHUNK))
      .onConflictDoNothing()
      .run()
  }
  ```

### 7.9 Timestamp 직렬화/역직렬화

- Drizzle ORM은 `integer('...', { mode: 'timestamp_ms' })` 컬럼을 **Date 객체**로 반환
- `JSON.stringify(Date)` → ISO 문자열 (`"2026-03-08T12:00:00.000Z"`)
- `JSON.parse()` 후에는 문자열 그대로 남음 → Drizzle insert 시 **타입 불일치 에러**
- **해결**: export 시 Date → number(ms) 변환, import 시 number → Date 변환

```typescript
// Export: Date → number (ms)
function serializeForExport(data: any): any {
  return JSON.parse(
    JSON.stringify(data, (_, value) => (value instanceof Date ? value.getTime() : value))
  )
}

// Import: number → Date (Drizzle insert용)
function deserializeTimestamp(ms: number | null): Date | null {
  return ms != null ? new Date(ms) : null
}
```

- **영향 범위**: createdAt, updatedAt, doneAt, dueDate, startDate, startAt, endAt, remindAt 등 모든 timestamp_ms 컬럼
- nullable 타임스탬프(doneAt, dueDate, startDate 등)는 null 체크 필수

### 7.10 schedules.workspaceId nullable 주의

- **schedules 테이블만** workspaceId에 `.notNull()` 제약이 없음 (다른 모든 테이블은 `.notNull()`)
- 실제 서비스에서는 항상 workspaceId를 전달하므로 null인 레코드는 발생하지 않아야 함
- 하지만 방어적으로 export 시 `WHERE workspaceId = ?` 쿼리로 null 레코드는 자연스럽게 제외
- import 시에는 workspaceId를 새 값으로 교체하므로 문제 없음

### 7.11 버전 호환성

- manifest.version으로 포맷 버전 관리
- 향후 스키마 변경 시 마이그레이션 로직 추가 가능
- 지원하지 않는 version이면 에러 메시지 표시

---

## 8. 참고 사항

- reminders 테이블은 workspaceId FK가 없음
  - export 시: 워크스페이스의 todos + schedules ID로 `findByEntity()` 호출
  - import 시: entityId를 매핑된 새 ID로 교체
- Parcel Watcher 스냅샷 (`userData/workspace-snapshots/{workspaceId}.snapshot`)은 백업 불필요 — watcher 시작 시 자동 재생성
- ZIP 파일명: `rally-backup-{name}-{YYYYMMDD-HHmmss}.zip`
- 에러 시 트랜잭션 롤백: DB는 자동 롤백, 파일은 수동 정리 필요
- tab_sessions는 워크스페이스당 최대 1개 (workspaceId unique 제약)
- tab_sessions.id는 프로젝트 내 유일한 auto-increment PK — export 시 id 포함하되 import 시 제외하고 upsert로 자동 생성
- entity_links repository에 findByWorkspaceId 없음 — raw Drizzle 쿼리 필요 (`db.select().from(entityLinks).where(eq(entityLinks.workspaceId, wid))`)
- schedule_todos repository의 findTodosByScheduleId는 JOIN 결과 반환 — raw 쿼리로 원시 junction 레코드(scheduleId, todoId) 추출
- folders는 parentId 없이 relativePath 기반 계층 — import 시 depth 순 정렬 권장하나 `mkdirSync(recursive: true)`가 있으므로 필수는 아님
- tab.id는 nanoid가 아닌 pathname 기반 결정적 생성 (`createTabId()`) — pathname 매핑 후 재생성
- searchParams 중 `folderOpenState`만 folder ID를 포함 — JSON key 매핑 필요
- entity_links는 별도 id 컬럼 없음 — composite PK (sourceType, sourceId, targetType, targetId). export된 레코드는 이미 정규화(sourceType <= targetType)된 상태이므로 raw insert 시 sourceId/targetId만 매핑하고 순서는 유지
- tab_sessions.activePaneId는 JSON 내부가 아닌 별도 컬럼 — pane ID 매핑 후 반드시 교체 (누락 시 복구된 세션이 잘못된 pane을 가리킴)
- tab_snapshots에는 activePaneId 컬럼 없음 — 스냅샷 복원 시 별도 처리 불필요
- canvas_nodes.content는 plain text (entity ID 미포함) — 매핑 불필요
- csv_files.columnWidths는 `{"col_0": 150, "col_1": 200}` 형식의 픽셀 너비 — 매핑 불필요
- 노트 마크다운의 .images/ 참조는 상대 경로(`![](../.images/abc.png)`) — workspace path가 바뀌어도 동적으로 resolve되므로 경로 재작성 불필요
- DB 트랜잭션은 `db.$client.transaction(() => { ... })()` 패턴 사용 (better-sqlite3 네이티브)
- batch insert 시 SQLite bind parameter 제한(999)으로 CHUNK=99 분할 필요 (createFileRepository 패턴 참조)
- **[중요] Timestamp 직렬화**: Drizzle ORM이 timestamp_ms를 Date 객체로 반환 → JSON.stringify 시 ISO 문자열로 변환 → import 시 number(ms)로 다시 변환 필요. 이를 누락하면 DB insert 타입 에러 발생
- **[중요] tabsJson/panesJson Record KEY 매핑**: `Record<tabId, Tab>` 구조에서 key와 value.id가 반드시 일치해야 함. tab.id 매핑 시 Record key도 함께 교체 필수
- **[중요] 삭제된 엔티티 참조 탭**: tab_sessions에 `error: true`인 탭이나 삭제된 엔티티를 참조하는 탭이 있을 수 있음. mapId() 실패 시 해당 탭 제거 처리
- schedules.workspaceId만 `.notNull()` 제약 없음 — 다른 모든 테이블은 `.notNull()`. 실제로는 서비스에서 항상 workspaceId 전달하므로 null 레코드 없어야 하지만, export 쿼리에서 자연스럽게 필터됨
- db 인스턴스: `import { db } from '../db'` (싱글턴, 즉시 초기화)
- **[중요] Nullable FK 매핑**: `notes.folderId`, `todos.parentId`, `canvas_nodes.refId`, `Pane.activeTabId`는 null 가능 — `mapId(null)` 호출 시 throw 발생하므로 반드시 `mapIdOrNull()` 사용. folderId=null인 노트는 root 폴더에 위치한 것이므로 정상 케이스
- **[중요] 고아 참조 처리**: `entity_links`, `item_tags`, `reminders`에 삭제된 엔티티를 참조하는 레코드가 남아있을 수 있음. `mapIdOrSkip()`으로 매핑 시도 → null 반환 시 해당 레코드 삽입 skip. 데이터 무결성을 해치지 않으면서 안전하게 복구
- **[중요] handle() 동기 한계**: 기존 `handle()` (`src/main/lib/handle.ts`)은 동기 함수만 래핑 가능 — backup export/import는 ZIP 처리로 async 필수. `handleAsync()` 유틸을 추가하거나 IPC handler에서 직접 try/catch 사용

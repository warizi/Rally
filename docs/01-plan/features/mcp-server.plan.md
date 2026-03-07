# Plan: MCP Local Server

## 1. Overview

Rally Electron 앱에 MCP(Model Context Protocol) 서버를 내장하여, Claude Desktop / Claude Code 등 MCP 클라이언트에서 Rally 워크스페이스의 노트를 조회, 수정, 생성, 이동, 이름변경, 검색할 수 있게 한다.

**핵심 원칙**:
- MCP 서버는 DB를 직접 조작하지 않는다
- 모든 변경은 Electron main process의 서비스 레이어를 통한다
- MCP를 통한 변경은 화면에 즉시 반영된다 (활성/비활성 워크스페이스 모두)

## 2. Goals

| # | Goal | Priority |
|---|------|----------|
| G-1 | Electron main에 Unix Domain Socket HTTP API 서버 내장 | Must |
| G-2 | MCP 서버 (stdio) — HTTP API 프록시 | Must |
| G-3 | Claude Desktop / Claude Code에 등록 가능 | Must |
| G-4 | Tool: `list_workspaces` — 워크스페이스 목록 | Must |
| G-5 | Tool: `list_folders` — 폴더 목록 | Must |
| G-6 | Tool: `list_notes` — 노트 목록 | Must |
| G-7 | Tool: `read_note` — 노트 내용 읽기 | Must |
| G-8 | Tool: `write_note` — 노트 내용 수정 | Must |
| G-9 | Tool: `create_note` — 노트 생성 | Must |
| G-10 | Tool: `rename_note` — 노트 이름변경 | Must |
| G-11 | Tool: `move_note` — 노트 이동 | Must |
| G-12 | Tool: `search_notes` — 노트 검색 (제목/내용) | Must |
| G-13 | MCP 변경 시 화면 즉시 반영 (활성/비활성 워크스페이스 모두) | Must |

## 3. Background & Context

### 3.1 MCP Protocol

MCP(Model Context Protocol)는 AI 모델이 외부 도구/데이터에 접근하기 위한 표준 프로토콜.

- **Transport**: stdio (표준 입출력) — 클라이언트가 별도 프로세스로 실행
- **Primitives**: Tools (함수 호출), Resources (데이터 URI), Prompts (템플릿)
- **SDK**: `@modelcontextprotocol/sdk` (TypeScript)

### 3.2 Rally 현재 아키텍처

- Electron main process에서 SQLite DB + 파일시스템 직접 접근
- `noteService`가 노트 CRUD 전담 (readByWorkspace, readContent, writeContent, create, rename, move 등)
- `workspaceRepository`, `folderRepository`로 각각 관리
- DB: `better-sqlite3` + Drizzle ORM, WAL 모드
- `workspace-watcher`: @parcel/watcher로 FS 변경 감지 → `BrowserWindow.webContents.send(channel)` → renderer re-fetch
- **주의**: workspace-watcher는 **현재 활성 워크스페이스만** 감시 (한 번에 하나)

### 3.3 핵심 설계: DB 직접 조작 금지 + 화면 즉시 반영

**문제**: MCP 서버가 DB를 직접 건드리면
1. Electron main의 서비스 로직(이미지 정리, sibling reindex, preview 업데이트 등)을 우회
2. Renderer가 변경을 감지할 방법이 없음
3. DB 동시 쓰기 충돌 위험

**해결**: 2-계층 프록시 아키텍처

```
Claude Desktop ──stdio──► MCP Server (Node.js) ──UDS/HTTP──► Electron Main (API)
                                                                  │
                                                           noteService.xxx()
                                                                  │
                                                            DB + FS 변경
                                                                  │
                                              ┌───────────────────┤
                                              │                   │
                                    HTTP API 핸들러에서     workspace-watcher
                                   broadcastChanged()     (활성 워크스페이스만)
                                              │                   │
                                              ▼                   ▼
                                    BrowserWindow.send('note:changed')
                                              │
                                     Renderer re-fetch ✅
```

### 3.4 화면 반영 전략 (2중 보장)

workspace-watcher는 활성 워크스페이스만 감시하므로, **비활성 워크스페이스 변경 시 push가 발생하지 않는다.** 이를 해결하기 위해:

**HTTP API 핸들러에서 서비스 호출 후 직접 `BrowserWindow.send()`를 호출한다.**

> `pushChanged()`는 `WorkspaceWatcherService`의 private 메서드이므로, HTTP API 핸들러에서는 `BrowserWindow.getAllWindows().forEach(win => win.webContents.send(...))` 를 직접 호출한다. 반복 사용을 위해 별도 유틸 함수(`broadcastChanged`)로 추출한다.

```typescript
// src/main/mcp-api/lib/broadcast.ts
import { BrowserWindow } from 'electron'

export function broadcastChanged(channel: string, wsId: string, paths: string[]): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, wsId, paths)
  })
}

// HTTP API 핸들러 (pseudo code)
async function handleWriteNote(wsId, noteId, content) {
  noteService.writeContent(wsId, noteId, content)       // 검증 + 실행 (NotFoundError 시 throw)
  const note = noteRepository.findById(noteId)!         // 서비스 검증 후이므로 반드시 존재
  broadcastChanged('note:changed', wsId, [note.relativePath])
}
```

이렇게 하면:
- **활성 워크스페이스**: HTTP API push + watcher push → 2번 push 가능하지만, renderer가 re-fetch할 뿐 부작용 없음
- **비활성 워크스페이스**: HTTP API push만 발생 → renderer가 해당 워크스페이스의 캐시 무효화 → 전환 시 즉시 최신 상태

### 3.5 Watcher + Service 이중 조작 검증 (코드 기반)

MCP → HTTP API → noteService가 먼저 DB+FS를 변경하고, 이후 watcher가 같은 이벤트를 감지해도 문제없는지 코드 레벨에서 검증:

**writeContent**: noteService가 `fs.writeFileSync()` → watcher가 update 이벤트 감지 → `processFileTypeEvents()`는 create/delete만 처리하므로 update는 무시 → `pushChanged`만 호출. **이중 DB 조작 없음 ✅**

**create**: noteService가 DB insert + `fs.writeFileSync()` → watcher가 create 이벤트 감지 → `processFileTypeEvents()`에서 `findByRelativePath(rel)` → 이미 존재 → skip. **이중 insert 없음 ✅**

**rename**: noteService가 DB update(새 경로) + `fs.renameSync()` → watcher가 delete(old)+create(new) 감지 → rename 감지 로직에서 `findByRelativePath(oldRel)` → null (이미 업데이트됨) → skip → standalone create에서도 `findByRelativePath(newRel)` → 이미 존재 → skip. **이중 처리 없음 ✅**

**move**: rename과 동일 패턴. **이중 처리 없음 ✅**

### 3.6 MCP 서버 실행 조건

- **Rally 앱이 실행 중이어야 MCP 서버가 동작**한다 (HTTP API 의존)
- MCP 서버 자체는 별도 Node.js 프로세스 (Claude Desktop이 spawn)
- MCP 서버는 **매 Tool 호출 시 소켓 연결을 시도** (lazy connection)
  - Rally 미실행 → 연결 실패 → 에러 반환 ("Rally 앱이 실행 중이 아닙니다")
  - Rally 이후 실행 → 다음 Tool 호출 시 연결 성공
  - Rally 재시작 → 소켓 파일 재생성 → 다음 호출 시 자동 재연결

### 3.7 통신 방식: Unix Domain Socket

TCP 포트 대신 **Unix Domain Socket (UDS)**을 사용한다.

| 비교 | TCP + 포트 파일 | Unix Domain Socket |
|------|----------------|-------------------|
| 포트 관리 | 포트 파일 기록/삭제/stale 처리 | 불필요 (경로 고정) |
| 포트 충돌 | 가능 | 불가능 |
| Stale 처리 | PID 체크 필요 | `unlink` 후 `listen` |
| 보안 | 토큰 필요 | 파일시스템 권한으로 충분 |
| 복잡도 | 높음 (포트+PID+토큰) | 낮음 (소켓 파일 하나) |
| Windows | 그대로 동작 | Named pipe 분기 필요 |

**소켓 경로**:
```typescript
const socketPath = process.platform === 'win32'
  ? '\\\\.\\pipe\\rally-mcp'
  : path.join(os.homedir(), '.rally', 'mcp.sock')
```

**Node.js `http` 모듈은 UDS를 직접 지원**:
```typescript
// 서버 (Electron main)
http.createServer(handler).listen(socketPath)

// 클라이언트 (MCP server)
http.request({ socketPath, path: '/api/...' })
```

HTTP 시맨틱 (메서드, 경로, JSON body)은 그대로 사용하면서, 전송 계층만 TCP → UDS로 교체.

**생명주기**:
1. Rally 앱 시작 → `~/.rally/` 디렉토리 `mkdirSync({ recursive: true })` → 기존 소켓 파일 `unlink` → HTTP 서버 `listen(socketPath)`
2. MCP 서버 Tool 호출 시 → `socketPath`로 HTTP 요청
3. Rally 앱 종료 → `before-quit`에서 소켓 파일 `unlink` + 서버 `close()`
4. 비정상 종료 → 소켓 파일 남음 → 다음 Rally 시작 시 `unlink` 후 재생성

> **주의**: `~/.rally/` 디렉토리는 현재 코드베이스에서 사용되지 않는 새 경로. Rally 시작 시 반드시 생성 확인 필요.

## 4. Scope

### 4.1 In Scope

| Item | Description |
|------|-------------|
| HTTP API 서버 모듈 | `src/main/mcp-api/` — Electron main 내장, UDS HTTP API 서버 + 라우트 핸들러 |
| MCP 서버 엔트리포인트 | `src/mcp-server/index.ts` — stdio transport, UDS HTTP 프록시 (별도 프로세스) |
| Tool: `list_workspaces` | 워크스페이스 이름/경로 목록 |
| Tool: `list_folders` | 워크스페이스의 폴더 목록 (id, relativePath) |
| Tool: `list_notes` | 워크스페이스의 노트 목록 (id, title, path, preview, folderPath) |
| Tool: `read_note` | 노트 마크다운 내용 읽기 |
| Tool: `write_note` | 기존 노트 내용 수정 |
| Tool: `create_note` | 새 노트 생성 (선택적 초기 content) |
| Tool: `rename_note` | 노트 이름변경 |
| Tool: `move_note` | 노트를 다른 폴더로 이동 (대상 폴더 최상단에 배치) |
| Tool: `search_notes` | 제목/내용 기반 노트 검색 |
| 화면 즉시 반영 | HTTP API 핸들러에서 직접 broadcastChanged() 호출 |
| noteService.search | 검색 메서드 신규 구현 |
| 빌드 설정 | MCP 서버 별도 번들 (tsup) |
| 등록 가이드 | Claude Desktop / Claude Code 설정 예시 |

### 4.2 Out of Scope

| Item | Reason |
|------|--------|
| 노트 삭제 | 위험성 높음 — 향후 확인 흐름과 함께 추가 |
| CSV/PDF/Image 접근 | 향후 확장 |
| SSE/HTTP transport (MCP) | stdio만으로 충분 |
| Renderer UI | MCP 상태 표시 등은 향후 |
| Rally 미실행 시 독립 동작 | 서비스 레이어 의존 구조상 의도적 불가 |

## 5. Constraints

| # | Constraint |
|---|-----------|
| C-1 | MCP 서버는 DB를 직접 조작하지 않는다 |
| C-2 | 모든 데이터 접근은 Electron main의 HTTP API → 서비스 레이어를 통한다 |
| C-3 | 통신은 Unix Domain Socket (macOS/Linux) / Named Pipe (Windows) |
| C-4 | Rally 앱 실행 중에만 MCP 서버 동작 |
| C-5 | 화면 반영은 HTTP API 핸들러에서 직접 broadcastChanged() 호출 (watcher 의존 X) |
| C-6 | `@modelcontextprotocol/sdk` 공식 SDK 사용 |
| C-7 | MCP 서버 빌드는 Electron 빌드와 독립 |
| C-8 | 기존 Rally 기능에 영향 없음 |
| C-9 | HTTP API 에러 응답: `{ error: string, errorType: string }` + HTTP status. MCP Tool은 에러 시 `isError: true` + 에러 메시지 반환 |
| C-10 | 에러 타입 → HTTP 상태 매핑: `NotFoundError → 404`, `ValidationError → 400`, `ConflictError → 409`, 기타 → `500` |
| C-11 | HTTP 요청 body 크기 제한: 10MB (초과 시 413 반환) |

## 6. Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `@modelcontextprotocol/sdk` | latest | MCP 서버 SDK |
| `tsup` | latest (devDep) | MCP 서버 번들링 |
| Node.js `http` module | (built-in) | UDS HTTP API 서버 (추가 의존성 없음) |

## 7. Tool Specifications

### 7.1 `list_workspaces`
- **Input**: 없음
- **Output**: `{ workspaces: [{ id, name, path }] }`
- **Service**: `workspaceRepository.findAll()`

### 7.2 `list_folders`
- **Input**: `{ workspaceId: string }`
- **Output**: `{ folders: [{ id, relativePath, order }] }`
- **Service**: `workspaceRepository.findById(workspaceId)` (존재 검증) + `folderRepository.findByWorkspaceId(workspaceId)`
- **참고**: `move_note`에서 사용할 `targetFolderId`를 조회하기 위해 필수
- **⚠️ 검증 필요**: `folderRepository.findByWorkspaceId()`는 workspace 존재 여부를 검증하지 않음 (잘못된 workspaceId → 빈 배열 반환). HTTP API 핸들러에서 `workspaceRepository.findById(wsId)` → 없으면 404 반환 처리 필수

### 7.3 `list_notes`
- **Input**: `{ workspaceId: string }`
- **Output**: `{ notes: [{ id, title, relativePath, preview, folderId, folderPath, updatedAt }] }`
- **Service**: `noteService.readByWorkspaceFromDb(workspaceId)` (NoteNode[]) + `folderRepository.findByWorkspaceId(workspaceId)` (Folder[])
- **참고**: `NoteNode`에는 `folderId`만 존재. HTTP API 핸들러에서 folder Map (`folderId → relativePath`)을 만들어 `folderPath` 필드를 조인. AI가 폴더 구조 파악 가능
- **null 케이스**: 루트 레벨 노트(`folderId: null`)의 `folderPath`는 `null`로 반환. AI는 `folderPath: null` = 워크스페이스 루트로 해석

### 7.4 `read_note`
- **Input**: `{ workspaceId: string, noteId: string }`
- **Output**: `{ title, relativePath, content (markdown string) }`
- **Service**: `noteRepository.findById(noteId)` (메타데이터) + `noteService.readContent(workspaceId, noteId)` (content: string)
- **참고**: `readContent()`는 `string`만 반환하므로, HTTP API에서 `findById()`로 title/relativePath를 조합하여 응답 구성

### 7.5 `write_note`
- **Input**: `{ workspaceId: string, noteId: string, content: string }`
- **Output**: `{ success: true, title, relativePath }`
- **Service**: `noteRepository.findById(noteId)` (메타데이터) + `noteService.writeContent(workspaceId, noteId, content)` (void)
- **참고**: `writeContent()`는 `void` 반환. HTTP API에서 사전 `findById()`로 title/relativePath를 조회하여 응답 구성
- **⚠️ 이미지 자동 정리**: `writeContent()` 내부에서 `noteImageService.cleanupRemovedImages(oldContent, newContent)`가 호출됨. 기존 content에 있던 이미지 참조(`![](/.images/xxx.png)`)가 새 content에서 제거되면 **이미지 파일이 디스크에서 삭제됨**. MCP Tool description에 이 동작을 명시하여 AI가 이미지 태그를 실수로 제거하지 않도록 경고 필요
- **화면 반영**: API 핸들러에서 `broadcastChanged('note:changed', wsId, [relativePath])`

### 7.6 `create_note`
- **Input**: `{ workspaceId: string, folderId?: string, title: string, content?: string }`
- **Output**: `{ id, title, relativePath }`
- **Service**: `noteService.create(workspaceId, folderId, name)` → content 있으면 `noteService.writeContent()` 연속 호출
- **참고**: service 파라미터명은 `name` (Plan의 `title` → service의 `name`으로 매핑). HTTP API 레벨에서 create + writeContent를 하나의 요청으로 처리
- **타입 매핑**: Tool Input의 `folderId?: string` (optional) → service의 `folderId: string | null`. HTTP 핸들러에서 `body.folderId ?? null` 변환 필요
- **화면 반영**: API 핸들러에서 `broadcastChanged('note:changed', wsId, [relativePath])`

### 7.7 `rename_note`
- **Input**: `{ workspaceId: string, noteId: string, newName: string }`
- **Output**: `{ id, title, relativePath }`
- **Service**: `noteService.rename(workspaceId, noteId, newName)`
- **화면 반영**: API 핸들러에서 `broadcastChanged('note:changed', wsId, [oldRelPath, newRelPath])`
- **중요**: rename/move 호출 전 `noteRepository.findById(noteId)`로 **old path를 미리 캡처**해야 함 (호출 후에는 DB가 이미 업데이트되어 old path 소실)
  ```
  1. old = noteRepository.findById(noteId)  // old path 캡처
  2. result = noteService.rename(...)        // 실행
  3. broadcastChanged(..., [old.relativePath, result.relativePath])
  ```

### 7.8 `move_note`
- **Input**: `{ workspaceId: string, noteId: string, targetFolderId: string | null }`
- **Output**: `{ id, title, relativePath, folderId }`
- **Service**: `noteService.move(workspaceId, noteId, targetFolderId, 0)`
- **화면 반영**: API 핸들러에서 `broadcastChanged('note:changed', wsId, [oldRelPath, newRelPath])`
- **동작**: 이동 시 대상 폴더 **최상단(index 0)**에 배치
- **중요**: rename과 동일 — 호출 전 `noteRepository.findById(noteId)`로 old path 캡처 필요
- **참고**: `list_folders`로 유효한 `targetFolderId` 사전 조회 필요. `null`이면 루트로 이동.
- **같은 폴더 이동**: `targetFolderId`가 현재 `folderId`와 동일하면 FS 조작 없이 `order` 재정렬만 수행 (index 0). broadcast에서 old/new path가 동일하지만 부작용 없음

### 7.9 `search_notes`
- **Input**: `{ workspaceId: string, query: string }`
- **Output**: `{ results: [{ id, title, relativePath, preview, matchType: 'title' | 'content' }] }`
- **동작**:
  1. DB에서 Drizzle ORM `like(notes.title, pattern)` 검색 → matchType: 'title' (SQL 인젝션 방지: 반드시 Drizzle 파라미터 바인딩 사용, raw SQL 금지)
  2. 매칭되지 않은 노트의 .md 파일 내용에서 `query` 포함 여부 검색 → matchType: 'content'
  3. 최대 50건 반환
- **Service**: `noteService.search(workspaceId, query)` — 신규 구현
- **⚠️ 이벤트 루프 블로킹 방지**: 파일 내용 검색(content search)은 `fs.promises.readFile` 비동기 사용. 청크 단위(10개씩)로 `Promise.all` 처리하여 main process 블로킹 최소화. `better-sqlite3`(동기식) DB 쿼리는 title 검색에서만 사용하므로 영향 미미
- **기존 패턴 참고**: `canvasRepository.findByWorkspaceId(wsId, search?)` — Drizzle `like()` + `or()` 조합

## 8. Architecture

```
┌──────────────────────┐     stdio      ┌──────────────────────┐
│  Claude Desktop /    │ ◄────────────► │   MCP Server         │
│  Claude Code         │                │   (Node.js process)  │
└──────────────────────┘                │                      │
                                        │  src/mcp-server/     │
                                        │   index.ts           │
                                        │   tools/*.ts         │
                                        └──────────┬───────────┘
                                                   │ UDS HTTP
                                                   │ (~/.rally/mcp.sock)
                                        ┌──────────▼───────────┐
                                        │  Rally Electron App  │
                                        │  (main process)      │
                                        │                      │
                                        │  UDS HTTP API Server │
                                        │  ┌────────────────┐  │
                                        │  │/api/workspaces│──┼──► service layer
                                        │  └────────┬───────┘  │
                                        │           │          │
                                        │  service.xxx()       │
                                        │    ├─► DB write      │
                                        │    └─► FS write      │
                                        │           │          │
                                        │  broadcastChanged()◄──┘
                                        │  (API 핸들러에서 직접)
                                        │           │
                                        │  BrowserWindow.send  │
                                        └──────────┬───────────┘
                                                   │ IPC push
                                        ┌──────────▼───────────┐
                                        │  Renderer (React)    │
                                        │  React Query 캐시    │
                                        │  자동 re-fetch ✅     │
                                        └──────────────────────┘
```

## 9. File Structure (런타임 분리)

두 프로세스의 코드를 명확히 분리한다.

```
src/main/mcp-api/              ← Electron main process 내부 (HTTP API 서버)
  server.ts                     ← http.createServer + UDS listen/close
  router.ts                     ← URL 패턴 매칭 + JSON body 파싱 + 에러 핸들링
  routes/                       ← 엔드포인트 핸들러
    workspace.ts                ← GET /api/workspaces
    folder.ts                   ← GET /api/workspaces/:wsId/folders
    note.ts                     ← GET/POST notes, GET/PUT content, PATCH rename/move
    search.ts                   ← GET /api/workspaces/:wsId/notes/search
  lib/
    broadcast.ts                ← broadcastChanged 유틸
    body-parser.ts              ← JSON body 파싱 (10MB 제한)

src/mcp-server/                 ← 별도 Node.js 프로세스 (Claude가 spawn)
  index.ts                      ← stdio transport entry + MCP server setup
  tools/                        ← 9개 tool 정의 (각 tool → HTTP 요청 매핑)
    list-workspaces.ts
    list-folders.ts
    list-notes.ts
    read-note.ts
    write-note.ts
    create-note.ts
    rename-note.ts
    move-note.ts
    search-notes.ts
  lib/
    http-client.ts              ← UDS HTTP 클라이언트 (lazy connection)
  tsup.config.ts                ← 독립 빌드 설정
```

**분리 이유**:
- `src/main/mcp-api/`는 Electron main process에서 실행. `electron`, `better-sqlite3`, service layer import 가능
- `src/mcp-server/`는 **별도 Node.js 프로세스**. Electron import **불가**. `http` + `@modelcontextprotocol/sdk`만 사용
- `electron-vite`는 `src/main/index.ts`부터 tree-shake → `src/mcp-server/`는 빌드에 포함되지 않음
- MCP 서버 빌드 출력: `dist-mcp/mcp-server.js` (`out/`은 Electron 빌드 전용)

### 9.1 HTTP API 라우팅 전략

외부 라우팅 라이브러리 없이 **직접 패턴 매칭**:

```typescript
// src/main/mcp-api/router.ts (pseudo code)
type RouteHandler = (params: Record<string, string>, body: any) => any

const routes: Array<{ method: string; pattern: RegExp; handler: RouteHandler }> = [
  { method: 'GET', pattern: /^\/api\/workspaces$/, handler: listWorkspaces },
  { method: 'GET', pattern: /^\/api\/workspaces\/([^/]+)\/folders$/, handler: listFolders },
  // ...
]

// body parser: req.on('data') + JSON.parse, 10MB 제한 (Content-Length 체크)
// 에러 핸들링: try-catch → NotFoundError→404, ValidationError→400, ConflictError→409, else→500
```

### 9.2 HTTP API Endpoints

모든 엔드포인트는 `/api/workspaces/:wsId` 하위로 통일.

| Method | Path | Service Call |
|--------|------|-------------|
| GET | `/api/workspaces` | `workspaceRepository.findAll()` |
| GET | `/api/workspaces/:wsId/folders` | `folderRepository.findByWorkspaceId(wsId)` |
| GET | `/api/workspaces/:wsId/notes` | `noteService.readByWorkspaceFromDb(wsId)` |
| GET | `/api/workspaces/:wsId/notes/:noteId/content` | `noteService.readContent(wsId, noteId)` |
| PUT | `/api/workspaces/:wsId/notes/:noteId/content` | `noteService.writeContent(wsId, noteId, content)` |
| POST | `/api/workspaces/:wsId/notes` | `noteService.create(wsId, folderId, name)` + writeContent |
| PATCH | `/api/workspaces/:wsId/notes/:noteId/rename` | `noteService.rename(wsId, noteId, newName)` |
| PATCH | `/api/workspaces/:wsId/notes/:noteId/move` | `noteService.move(wsId, noteId, folderId, 0)` |
| GET | `/api/workspaces/:wsId/notes/search?q=` | `noteService.search(wsId, query)` |

## 10. Success Criteria

| # | Criteria | Metric |
|---|---------|--------|
| SC-1 | Claude Desktop/Code에서 워크스페이스 목록 조회 | Pass/Fail |
| SC-2 | Claude Desktop/Code에서 폴더 목록 조회 | Pass/Fail |
| SC-3 | Claude Desktop/Code에서 노트 목록 조회 | Pass/Fail |
| SC-4 | Claude Desktop/Code에서 노트 내용 읽기 | Pass/Fail |
| SC-5 | Claude Desktop/Code에서 노트 내용 수정 | Pass/Fail |
| SC-6 | Claude Desktop/Code에서 노트 생성 | Pass/Fail |
| SC-7 | Claude Desktop/Code에서 노트 이름변경 | Pass/Fail |
| SC-8 | Claude Desktop/Code에서 노트 이동 | Pass/Fail |
| SC-9 | Claude Desktop/Code에서 노트 검색 | Pass/Fail |
| SC-10 | MCP 수정 후 Rally 화면에 즉시 반영 — 활성 워크스페이스 (< 1초) | Pass/Fail |
| SC-11 | MCP 수정 후 Rally 화면에 즉시 반영 — 비활성 워크스페이스 (< 1초) | Pass/Fail |
| SC-12 | Rally 미실행 시 명확한 에러 메시지 | Pass/Fail |
| SC-13 | Rally 이후 실행 시 MCP 재연결 성공 | Pass/Fail |
| SC-14 | 기존 Rally 기능에 영향 없음 | 647 tests pass |

## 11. Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| R-1 | Rally 앱 미실행 시 MCP 동작 불가 | 중간 | Lazy connection + 명확한 에러 메시지 |
| R-2 | Windows Named Pipe 호환성 | 낮음 | 소켓 경로 분기 한 줄로 해결 |
| R-3 | search_notes 성능 (대량 파일 grep) | 중간 | 결과 수 제한 (max 50), DB title 우선 검색 |
| R-4 | 비활성 워크스페이스 broadcastChanged 시 불필요한 re-fetch | 낮음 | re-fetch 비용 미미, 부작용 없음 |
| R-5 | MCP 빌드와 Electron 빌드 충돌 | 중간 | 완전 독립 빌드 (tsup, 별도 entry) |
| R-6 | 비정상 종료 시 stale 소켓 파일 | 낮음 | Rally 시작 시 항상 unlink 후 listen |
| R-7 | search_notes 파일 내용 검색이 main process 블로킹 | 높음 | `fs.promises.readFile` 비동기 + 청크(10개씩) 처리, title 검색 우선 |
| R-8 | write_note 시 AI가 이미지 참조 실수로 제거 → 이미지 파일 삭제 | 중간 | MCP Tool description에 이미지 참조 보존 경고 명시 |

## 12. Implementation Strategy

### 구현 순서

1. **`src/main/mcp-api/` 모듈** — `http.createServer` + UDS listen + `~/.rally/` 디렉토리 생성
2. **라우터 + body parser** — URL 패턴 매칭, JSON body 파싱 (10MB 제한), 에러 타입 → HTTP 상태 매핑
3. **소켓 파일 생명주기** — `app.whenReady()`에서 서버 시작, `before-quit`에서 unlink + close
4. **broadcastChanged 유틸** — 각 변경 API 핸들러에서 `BrowserWindow.send()` 호출
5. **9개 API 라우트 핸들러** — 섹션 9.2의 엔드포인트 구현
6. **noteService.search 구현** — Drizzle `like()` + `fs.promises.readFile` 비동기 청크 검색
7. **`src/mcp-server/` 모듈** — stdio transport, lazy connection, UDS HTTP 클라이언트
8. **9개 MCP Tool 정의** — 각 Tool → HTTP 요청 매핑, `isError` 에러 처리
9. **tsup 빌드 설정** — `src/mcp-server/index.ts` → `dist-mcp/mcp-server.js`
10. **등록 가이드** — Claude Desktop / Claude Code 설정 예시

### MCP 서버 연결 전략

```
Tool 호출 시:
  1. 소켓 파일 존재 확인
  2. HTTP 요청 시도 (socketPath)
  3. 성공 → 결과 반환
  4. 실패 (ECONNREFUSED / ENOENT) → 에러 반환: "Rally 앱이 실행 중이 아닙니다"
  5. 다음 Tool 호출 시 → 1부터 재시도 (lazy, 상태 없음)
```

## 13. Claude Desktop / Code 등록 예시

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "rally": {
      "command": "node",
      "args": ["/path/to/rally/dist-mcp/mcp-server.js"]
    }
  }
}
```

### Claude Code
```bash
claude mcp add rally -- node /path/to/rally/dist-mcp/mcp-server.js
```

MCP 서버가 시작되면 `~/.rally/mcp.sock` 소켓 파일을 통해 Rally 앱에 자동 연결한다.
Rally 앱이 실행 중이 아니면 각 Tool 호출 시 에러를 반환하고, Rally 실행 후 다음 호출부터 자동 연결된다.

## 14. References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- Rally Note Service: `src/main/services/note.ts`
- Rally Workspace Watcher: `src/main/services/workspace-watcher.ts` (pushChanged: L543-547)
- Rally Folder Repository: `src/main/repositories/folder.ts`
- Rally IPC Note Handlers: `src/main/ipc/note.ts`

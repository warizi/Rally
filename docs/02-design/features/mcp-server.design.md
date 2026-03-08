# MCP Server Design Document

> **Summary**: Rally Electron 앱에 MCP(Model Context Protocol) 서버를 내장한다. Electron main process에 UDS HTTP API 서버를 추가하고, 별도 Node.js 프로세스인 MCP 서버가 stdio transport로 Claude와 통신하며 UDS를 통해 Rally API를 호출한다.
>
> **Date**: 2026-03-07
> **Status**: Draft
> **Planning Doc**: [mcp-server.plan.md](../../01-plan/features/mcp-server.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- Electron main process에 UDS HTTP API 서버 내장 (`src/main/mcp-api/`)
- 별도 Node.js 프로세스로 MCP 서버 구현 (`src/mcp-server/`)
- 9개 MCP Tool 제공 (list_workspaces, list_folders, list_notes, read_note, write_note, create_note, rename_note, move_note, search_notes)
- MCP를 통한 변경이 Rally 화면에 즉시 반영 (활성/비활성 워크스페이스 모두)
- noteService.search 신규 구현

### 1.2 Design Principles

- **DB 직접 조작 금지** — MCP 서버는 HTTP API를 통해서만 서비스 레이어에 접근
- **런타임 분리** — `src/main/mcp-api/`(Electron)과 `src/mcp-server/`(standalone Node.js)는 완전히 독립
- **Lazy Connection** — MCP 서버는 상태 없음. 매 Tool 호출 시 소켓 연결 시도
- **broadcastChanged 직접 호출** — watcher 의존 없이 HTTP API 핸들러에서 직접 `BrowserWindow.send()`
- **기존 패턴 준수** — 에러 타입(NotFoundError/ValidationError/ConflictError), Drizzle ORM 파라미터 바인딩, 기존 서비스 메서드 재사용
- **최소 의존성** — HTTP API는 Node.js `http` 내장 모듈만 사용, 외부 라우팅 라이브러리 없음

---

## 2. Architecture

### 2.1 Data Flow

```
[MCP Tool 호출]
  Claude Desktop/Code → stdio → MCP Server (src/mcp-server/)
    → http.request({ socketPath: '~/.rally/mcp.sock', path: '/api/...' })
    → Electron Main (src/main/mcp-api/)
    → router.ts: URL 패턴 매칭 + JSON body 파싱
    → routes/*.ts: 서비스 레이어 호출

[읽기 요청] (GET)
  handler → service/repository 호출 → JSON 응답 반환

[쓰기 요청] (POST/PUT/PATCH)
  handler → service 호출 → broadcastChanged() → JSON 응답 반환
  broadcastChanged: BrowserWindow.getAllWindows().forEach(win => win.webContents.send(...))

[Renderer 반영]
  BrowserWindow.send('note:changed', wsId, paths)
    → use-file-watcher.ts: queryClient.invalidateQueries({ queryKey: ['note', 'workspace', wsId] })
    → React Query re-fetch
```

### 2.2 Layer Map

```
+-- Electron Main Process (src/main/) ---------------------+
|  mcp-api/server.ts       UDS HTTP 서버 start/stop         |
|  mcp-api/router.ts       URL 패턴 매칭 + body 파싱 + 에러  |
|  mcp-api/routes/*.ts     9개 엔드포인트 핸들러              |
|  mcp-api/lib/broadcast.ts   broadcastChanged 유틸         |
|  mcp-api/lib/body-parser.ts JSON body 파서 (10MB 제한)     |
|  services/note.ts        noteService (기존 + search 추가)  |
|  index.ts                앱 생명주기에 서버 start/stop 추가  |
+-- Standalone Node.js Process (src/mcp-server/) -----------+
|  index.ts                stdio transport + MCP Server setup|
|  tools/*.ts              9개 Tool → HTTP 요청 매핑          |
|  lib/http-client.ts      UDS HTTP 클라이언트 (lazy)        |
|  tsup.config.ts          독립 빌드 설정                     |
+-----------------------------------------------------------+
```

---

## 3. Data Model

DB 스키마 변경 없음. 기존 테이블만 사용한다.

### 3.1 사용하는 기존 테이블

| Table        | Used By                             | Key Columns                                                                  |
| ------------ | ----------------------------------- | ---------------------------------------------------------------------------- |
| `workspaces` | list_workspaces                     | `id`, `name`, `path`                                                         |
| `folders`    | list_folders, list_notes, move_note | `id`, `workspaceId`, `relativePath`, `order`                                 |
| `notes`      | 모든 note Tool                      | `id`, `workspaceId`, `folderId`, `relativePath`, `title`, `preview`, `order` |

### 3.2 HTTP API 응답 타입 (TypeScript)

```typescript
// GET /api/workspaces
interface ListWorkspacesResponse {
  workspaces: { id: string; name: string; path: string }[]
}

// GET /api/workspaces/:wsId/folders
interface ListFoldersResponse {
  folders: { id: string; relativePath: string; order: number }[]
}

// GET /api/workspaces/:wsId/notes
interface ListNotesResponse {
  notes: {
    id: string
    title: string
    relativePath: string
    preview: string
    folderId: string | null
    folderPath: string | null // folder Map 조인
    updatedAt: string // ISO string
  }[]
}

// GET /api/workspaces/:wsId/notes/:noteId/content
interface ReadNoteResponse {
  title: string
  relativePath: string
  content: string
}

// PUT /api/workspaces/:wsId/notes/:noteId/content
interface WriteNoteResponse {
  success: true
  title: string
  relativePath: string
}

// POST /api/workspaces/:wsId/notes
interface CreateNoteResponse {
  id: string
  title: string
  relativePath: string
}

// PATCH /api/workspaces/:wsId/notes/:noteId/rename
interface RenameNoteResponse {
  id: string
  title: string
  relativePath: string
}

// PATCH /api/workspaces/:wsId/notes/:noteId/move
interface MoveNoteResponse {
  id: string
  title: string
  relativePath: string
  folderId: string | null
}

// GET /api/workspaces/:wsId/notes/search?q=
interface SearchNotesResponse {
  results: {
    id: string
    title: string
    relativePath: string
    preview: string
    matchType: 'title' | 'content'
  }[]
}

// Error Response (4xx/5xx)
interface ErrorResponse {
  error: string
  errorType: string // 'NotFoundError' | 'ValidationError' | 'ConflictError' | 'PayloadTooLargeError' | 'UnknownError'
}
```

---

## 4. HTTP API Endpoints

### 4.1 Routing Table

| Method | Path                                          | Handler        | Service Call                                                              |
| ------ | --------------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| GET    | `/api/workspaces`                             | `workspace.ts` | `workspaceRepository.findAll()`                                           |
| GET    | `/api/workspaces/:wsId/folders`               | `folder.ts`    | `workspaceRepository.findById()` + `folderRepository.findByWorkspaceId()` |
| GET    | `/api/workspaces/:wsId/notes`                 | `note.ts`      | `noteService.readByWorkspaceFromDb()` + folder Map 조인                   |
| GET    | `/api/workspaces/:wsId/notes/search`          | `search.ts`    | `noteService.search()`                                                    |
| GET    | `/api/workspaces/:wsId/notes/:noteId/content` | `note.ts`      | `noteRepository.findById()` + `noteService.readContent()`                 |
| PUT    | `/api/workspaces/:wsId/notes/:noteId/content` | `note.ts`      | `noteRepository.findById()` + `noteService.writeContent()`                |
| POST   | `/api/workspaces/:wsId/notes`                 | `note.ts`      | `noteService.create()` + optional `noteService.writeContent()`            |
| PATCH  | `/api/workspaces/:wsId/notes/:noteId/rename`  | `note.ts`      | `noteRepository.findById()` + `noteService.rename()`                      |
| PATCH  | `/api/workspaces/:wsId/notes/:noteId/move`    | `note.ts`      | `noteRepository.findById()` + `noteService.move()`                        |

### 4.2 URL 매칭 순서 (중요)

`/api/workspaces/:wsId/notes/search`는 `/api/workspaces/:wsId/notes/:noteId`보다 **먼저** 매칭되어야 한다. "search"가 `:noteId`로 캡처되는 것을 방지하기 위해 routes 배열에서 search 패턴을 note 패턴보다 앞에 배치한다.

---

## 5. Implementation Details

### 5.1 UDS HTTP Server — `src/main/mcp-api/server.ts`

```typescript
import http from 'http'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { router } from './router'

const socketPath =
  process.platform === 'win32'
    ? '\\\\.\\pipe\\rally-mcp'
    : path.join(os.homedir(), '.rally', 'mcp.sock')

let server: http.Server | null = null

export function startMcpApiServer(): void {
  // ~/.rally/ 디렉토리 생성 (최초 실행 시)
  if (process.platform !== 'win32') {
    const dir = path.dirname(socketPath)
    fs.mkdirSync(dir, { recursive: true })
  }

  // stale 소켓 파일 제거 (비정상 종료 대응)
  try {
    fs.unlinkSync(socketPath)
  } catch {
    // 파일 없으면 무시
  }

  server = http.createServer(router)
  server.listen(socketPath, () => {
    console.log(`[MCP API] Listening on ${socketPath}`)
  })
}

export function stopMcpApiServer(): void {
  if (server) {
    server.close()
    server = null
  }
  // 소켓 파일 정리
  try {
    fs.unlinkSync(socketPath)
  } catch {
    // 무시
  }
}
```

**핵심 포인트**:

- `socketPath`: macOS/Linux는 `~/.rally/mcp.sock`, Windows는 Named Pipe
- `startMcpApiServer()`: `mkdirSync({ recursive: true })` → `unlinkSync` → `listen`
- `stopMcpApiServer()`: `server.close()` → `unlinkSync`
- `~/.rally/`는 이 기능에서 최초 생성되는 새 디렉토리

### 5.2 Router — `src/main/mcp-api/router.ts`

```typescript
import http from 'http'
import { parseBody, PayloadTooLargeError } from './lib/body-parser'
import { NotFoundError, ValidationError, ConflictError } from '../lib/errors'

type RouteParams = Record<string, string>
type RouteHandler = (params: RouteParams, body: any, query: URLSearchParams) => any | Promise<any>

interface Route {
  method: string
  pattern: RegExp
  paramNames: string[]
  handler: RouteHandler
}

const routes: Route[] = []

export function addRoute(method: string, pathPattern: string, handler: RouteHandler): void {
  // '/api/workspaces/:wsId/notes/:noteId' → RegExp + paramNames ['wsId', 'noteId']
  const paramNames: string[] = []
  const regexStr = pathPattern.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name)
    return '([^/]+)'
  })
  routes.push({
    method,
    pattern: new RegExp(`^${regexStr}$`),
    paramNames,
    handler
  })
}

function mapErrorToStatus(error: Error): number {
  if (error instanceof PayloadTooLargeError) return 413
  if (error instanceof NotFoundError) return 404
  if (error instanceof ValidationError) return 400
  if (error instanceof ConflictError) return 409
  return 500
}

function mapErrorToType(error: Error): string {
  if (error instanceof PayloadTooLargeError) return 'PayloadTooLargeError'
  if (error instanceof NotFoundError) return 'NotFoundError'
  if (error instanceof ValidationError) return 'ValidationError'
  if (error instanceof ConflictError) return 'ConflictError'
  return 'UnknownError'
}

export async function router(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const urlObj = new URL(req.url || '/', 'http://localhost')
  const pathname = urlObj.pathname
  const query = urlObj.searchParams
  const method = req.method || 'GET'

  // CORS 등 불필요 (UDS, 로컬 통신)

  for (const route of routes) {
    if (route.method !== method) continue
    const match = pathname.match(route.pattern)
    if (!match) continue

    const params: RouteParams = {}
    for (let i = 0; i < route.paramNames.length; i++) {
      params[route.paramNames[i]] = decodeURIComponent(match[i + 1])
    }

    try {
      const body = method === 'GET' ? null : await parseBody(req)
      const result = await Promise.resolve(route.handler(params, body, query))

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (error) {
      if (error instanceof Error) {
        const status = mapErrorToStatus(error)
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error.message, errorType: mapErrorToType(error) }))
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: String(error), errorType: 'UnknownError' }))
      }
    }
    return
  }

  // 매칭 없음
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not Found', errorType: 'NotFoundError' }))
}
```

**핵심 포인트**:

- `addRoute()`: 경로 패턴 → RegExp 변환. `:param` → `([^/]+)` 매핑
- `mapErrorToStatus()`: 기존 `errors.ts`의 3가지 에러 타입 → HTTP 상태 코드
- `parseBody()`는 별도 모듈 (5.3)
- `route.handler`는 동기/비동기 모두 지원 (`Promise.resolve()` 래핑)
- search 경로를 noteId 경로보다 먼저 등록하여 "search"가 `:noteId`로 잡히는 것 방지

### 5.3 Body Parser — `src/main/mcp-api/lib/body-parser.ts`

```typescript
import http from 'http'
import { ValidationError } from '../../lib/errors'

const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10MB

export class PayloadTooLargeError extends Error {
  constructor() {
    super('Request body too large (max 10MB)')
    this.name = 'PayloadTooLargeError'
  }
}

export function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    // Content-Length 사전 체크
    const contentLength = parseInt(req.headers['content-length'] || '0', 10)
    if (contentLength > MAX_BODY_SIZE) {
      reject(new PayloadTooLargeError())
      return
    }

    const chunks: Buffer[] = []
    let size = 0
    let destroyed = false

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_SIZE) {
        destroyed = true
        req.destroy()
        reject(new PayloadTooLargeError())
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      if (destroyed) return // reject 이후 end 도착 시 무시
      if (size === 0) {
        resolve(null)
        return
      }
      try {
        const raw = Buffer.concat(chunks).toString('utf-8')
        resolve(JSON.parse(raw))
      } catch {
        reject(new ValidationError('Invalid JSON body'))
      }
    })

    req.on('error', (err) => {
      if (!destroyed) reject(err) // destroy 후 error 이벤트 무시
    })
  })
}
```

**핵심 포인트**:

- 10MB 제한 (C-11): Content-Length 사전 체크 + 스트리밍 중 크기 체크 이중 방어
- body 크기 초과 시 `PayloadTooLargeError` → router에서 **413** 반환 (Plan C-11 준수)
- `destroyed` 플래그로 `req.destroy()` 후 `end`/`error` 이벤트의 이중 reject 방지
- body 없는 경우 (`size === 0`) → `null` 반환
- JSON 파싱 실패 → `ValidationError` (400)

### 5.4 broadcastChanged Utility — `src/main/mcp-api/lib/broadcast.ts`

```typescript
import { BrowserWindow } from 'electron'

export function broadcastChanged(channel: string, wsId: string, paths: string[]): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, wsId, paths)
  })
}
```

**핵심 포인트**:

- `workspace-watcher.ts`의 `pushChanged()` (L543-547)와 동일 로직이지만, private 메서드이므로 별도 유틸로 추출
- `channel`은 `'note:changed'` 사용 (기존 watcher 패턴과 동일)
- Renderer의 `use-file-watcher.ts`가 `queryClient.invalidateQueries()` 호출 → re-fetch
- 활성 워크스페이스: watcher push + API push → 2번 push 가능하지만 re-fetch일 뿐 부작용 없음

### 5.5 Route Handlers — `src/main/mcp-api/routes/workspace.ts`

```typescript
import { addRoute } from '../router'
import { workspaceRepository } from '../../repositories/workspace'

export function registerWorkspaceRoutes(): void {
  // GET /api/workspaces
  addRoute('GET', '/api/workspaces', () => {
    const workspaces = workspaceRepository.findAll()
    return {
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        path: w.path
      }))
    }
  })
}
```

### 5.6 Route Handlers — `src/main/mcp-api/routes/folder.ts`

```typescript
import { addRoute } from '../router'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { NotFoundError } from '../../lib/errors'

export function registerFolderRoutes(): void {
  // GET /api/workspaces/:wsId/folders
  addRoute('GET', '/api/workspaces/:wsId/folders', (params) => {
    // folderRepository는 workspace 존재 검증 안 함 → 직접 검증
    const workspace = workspaceRepository.findById(params.wsId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${params.wsId}`)

    const folders = folderRepository.findByWorkspaceId(params.wsId)
    return {
      folders: folders.map((f) => ({
        id: f.id,
        relativePath: f.relativePath,
        order: f.order
      }))
    }
  })
}
```

### 5.7 Route Handlers — `src/main/mcp-api/routes/note.ts`

```typescript
import { addRoute } from '../router'
import { noteService } from '../../services/note'
import { noteRepository } from '../../repositories/note'
import { folderRepository } from '../../repositories/folder'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { broadcastChanged } from '../lib/broadcast'

/** body가 null이면 ValidationError throw */
function requireBody(body: any): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required')
  }
}

export function registerNoteRoutes(): void {
  // GET /api/workspaces/:wsId/notes
  addRoute('GET', '/api/workspaces/:wsId/notes', (params) => {
    const notes = noteService.readByWorkspaceFromDb(params.wsId)
    const folders = folderRepository.findByWorkspaceId(params.wsId)
    const folderMap = new Map(folders.map((f) => [f.id, f.relativePath]))

    return {
      notes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        relativePath: n.relativePath,
        preview: n.preview,
        folderId: n.folderId,
        folderPath: n.folderId ? (folderMap.get(n.folderId) ?? null) : null,
        updatedAt: n.updatedAt.toISOString()
      }))
    }
  })

  // GET /api/workspaces/:wsId/notes/:noteId/content
  addRoute('GET', '/api/workspaces/:wsId/notes/:noteId/content', (params) => {
    const note = noteRepository.findById(params.noteId)
    if (!note) throw new NotFoundError(`Note not found: ${params.noteId}`)

    const content = noteService.readContent(params.wsId, params.noteId)
    return {
      title: note.title,
      relativePath: note.relativePath,
      content
    }
  })

  // PUT /api/workspaces/:wsId/notes/:noteId/content
  addRoute('PUT', '/api/workspaces/:wsId/notes/:noteId/content', (params, body) => {
    requireBody(body)
    // 메타데이터 사전 조회 (writeContent는 void 반환)
    const note = noteRepository.findById(params.noteId)
    if (!note) throw new NotFoundError(`Note not found: ${params.noteId}`)

    noteService.writeContent(params.wsId, params.noteId, body.content)

    broadcastChanged('note:changed', params.wsId, [note.relativePath])

    return {
      success: true,
      title: note.title,
      relativePath: note.relativePath
    }
  })

  // POST /api/workspaces/:wsId/notes
  addRoute('POST', '/api/workspaces/:wsId/notes', (params, body) => {
    requireBody(body)
    // body.folderId?: string → service의 folderId: string | null
    const folderId = body.folderId ?? null
    // body.title → service의 name 파라미터
    const result = noteService.create(params.wsId, folderId, body.title)

    // 선택적 초기 content 설정
    // create 성공 후 writeContent 실패해도 노트는 이미 존재 → broadcast 보장
    try {
      if (body.content) {
        noteService.writeContent(params.wsId, result.id, body.content)
      }
    } finally {
      broadcastChanged('note:changed', params.wsId, [result.relativePath])
    }

    return {
      id: result.id,
      title: result.title,
      relativePath: result.relativePath
    }
  })

  // PATCH /api/workspaces/:wsId/notes/:noteId/rename
  addRoute('PATCH', '/api/workspaces/:wsId/notes/:noteId/rename', (params, body) => {
    requireBody(body)
    // old path 캡처 (rename 후 DB 변경되므로 사전 조회 필수)
    const oldNote = noteRepository.findById(params.noteId)
    if (!oldNote) throw new NotFoundError(`Note not found: ${params.noteId}`)

    const result = noteService.rename(params.wsId, params.noteId, body.newName)

    broadcastChanged('note:changed', params.wsId, [oldNote.relativePath, result.relativePath])

    return {
      id: result.id,
      title: result.title,
      relativePath: result.relativePath
    }
  })

  // PATCH /api/workspaces/:wsId/notes/:noteId/move
  addRoute('PATCH', '/api/workspaces/:wsId/notes/:noteId/move', (params, body) => {
    requireBody(body)
    // old path 캡처
    const oldNote = noteRepository.findById(params.noteId)
    if (!oldNote) throw new NotFoundError(`Note not found: ${params.noteId}`)

    // targetFolderId?: string → service의 folderId: string | null
    const targetFolderId = body.targetFolderId ?? null
    // index 0: 대상 폴더 최상단에 배치
    const result = noteService.move(params.wsId, params.noteId, targetFolderId, 0)

    broadcastChanged('note:changed', params.wsId, [oldNote.relativePath, result.relativePath])

    return {
      id: result.id,
      title: result.title,
      relativePath: result.relativePath,
      folderId: result.folderId
    }
  })
}
```

**핵심 포인트**:

- **requireBody()**: PUT/POST/PATCH 핸들러에서 body null 체크. null body → `ValidationError` (400) 반환. TypeError(500) 방지
- **old path 캡처**: rename/move 핸들러에서 서비스 호출 **전에** `noteRepository.findById()`로 old path를 저장. 서비스 호출 후에는 DB가 이미 변경되어 old path 소실
- **타입 매핑**: `body.folderId ?? null` — MCP Tool의 optional string → service의 `string | null`
- **파라미터명 매핑**: `body.title` → `noteService.create(wsId, folderId, name)` — Plan의 `title`은 service의 `name` 파라미터
- **create + writeContent**: `try/finally`로 writeContent 실패해도 broadcastChanged 보장. create는 성공했으므로 renderer에 반드시 알림
- **writeContent 이미지 경고**: `writeContent()` 내부에서 `noteImageService.cleanupRemovedImages()`가 호출됨. MCP Tool description에 이미지 참조 보존 경고 필수
- **broadcastChanged**: 쓰기 작업(PUT/POST/PATCH)에서만 호출. 읽기(GET)에서는 불필요

### 5.8 Route Handlers — `src/main/mcp-api/routes/search.ts`

```typescript
import { addRoute } from '../router'
import { noteService } from '../../services/note'

export function registerSearchRoutes(): void {
  // GET /api/workspaces/:wsId/notes/search?q=
  // noteService.search()는 async → 핸들러도 async 필수
  addRoute('GET', '/api/workspaces/:wsId/notes/search', async (params, _body, query) => {
    const q = query.get('q') || ''
    if (!q.trim()) return { results: [] }

    const results = await noteService.search(params.wsId, q)
    return { results }
  })
}
```

### 5.9 Route Registration — `src/main/mcp-api/routes/index.ts`

```typescript
import { registerWorkspaceRoutes } from './workspace'
import { registerFolderRoutes } from './folder'
import { registerNoteRoutes } from './note'
import { registerSearchRoutes } from './search'

export function registerAllRoutes(): void {
  registerWorkspaceRoutes()
  registerFolderRoutes()
  // search를 note보다 먼저 등록 (URL 매칭 순서)
  registerSearchRoutes()
  registerNoteRoutes()
}
```

**핵심 포인트**:

- `registerSearchRoutes()`를 `registerNoteRoutes()`보다 **먼저** 호출
- `/api/workspaces/:wsId/notes/search`가 `/api/workspaces/:wsId/notes/:noteId/content`보다 먼저 매칭되어야 "search"가 `:noteId`로 캡처되지 않음

### 5.10 noteRepository.searchByTitle — `src/main/repositories/note.ts` 추가

기존 repository 패턴(`canvasRepository.findByWorkspaceId(wsId, search?)`)을 따라 title 검색을 repository 레벨에 추가한다.

```typescript
// noteRepository 객체에 추가
searchByTitle(workspaceId: string, query: string): Note[] {
  const pattern = `%${query}%`
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.workspaceId, workspaceId), like(notes.title, pattern)))
    .all()
}
```

**import 추가 필요**: `import { and, like } from 'drizzle-orm'` (기존 `eq` import에 병합)

### 5.11 noteService.search — `src/main/services/note.ts` 추가

```typescript
// noteService 객체에 search 메서드 추가
async search(
  workspaceId: string,
  query: string
): Promise<{ id: string; title: string; relativePath: string; preview: string; matchType: 'title' | 'content' }[]> {
  const workspace = workspaceRepository.findById(workspaceId)
  if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

  const MAX_RESULTS = 50
  const results: { id: string; title: string; relativePath: string; preview: string; matchType: 'title' | 'content' }[] = []

  // 1. DB title 검색 (repository 패턴 — Drizzle like() 파라미터 바인딩, SQL 인젝션 방지)
  const titleMatches = noteRepository.searchByTitle(workspaceId, query)

  const titleMatchIds = new Set<string>()
  for (const note of titleMatches) {
    if (results.length >= MAX_RESULTS) break
    results.push({
      id: note.id,
      title: note.title,
      relativePath: note.relativePath,
      preview: note.preview,
      matchType: 'title'
    })
    titleMatchIds.add(note.id)
  }

  // 2. 파일 내용 검색 (title에 매칭되지 않은 노트만)
  if (results.length < MAX_RESULTS) {
    const allNotes = noteRepository.findByWorkspaceId(workspaceId)
    const remaining = allNotes.filter((n) => !titleMatchIds.has(n.id))
    const lowerQuery = query.toLowerCase()

    // 비동기 청크 처리 (10개씩) — main process 이벤트 루프 블로킹 방지
    const CHUNK_SIZE = 10
    for (let i = 0; i < remaining.length && results.length < MAX_RESULTS; i += CHUNK_SIZE) {
      const chunk = remaining.slice(i, i + CHUNK_SIZE)
      const readResults = await Promise.all(
        chunk.map(async (note) => {
          try {
            const absPath = path.join(workspace.path, note.relativePath)
            const content = await fs.promises.readFile(absPath, 'utf-8')
            if (content.toLowerCase().includes(lowerQuery)) {
              return {
                id: note.id,
                title: note.title,
                relativePath: note.relativePath,
                preview: note.preview,
                matchType: 'content' as const
              }
            }
          } catch {
            // 파일 읽기 실패 시 무시 (삭제된 파일 등)
          }
          return null
        })
      )
      for (const r of readResults) {
        if (r && results.length < MAX_RESULTS) results.push(r)
      }
    }
  }

  return results
}
```

**핵심 포인트**:

- `search()`는 **async** 메서드 — `fs.promises.readFile` 사용으로 인해 기존 service 메서드(모두 동기)와 다름
- title 검색: `noteRepository.searchByTitle()` 사용 — 기존 `canvasRepository.findByWorkspaceId(wsId, search?)` 패턴과 일관
- content 검색: 10개씩 `Promise.all` 청크 처리 — main process 이벤트 루프 블로킹 최소화 (R-7 대응)
- 최대 50건 반환 (R-3 대응)
- 대소문자 무시 (`toLowerCase()`)
- router에서 `Promise.resolve()` 래핑이 있으므로 async handler도 자연스럽게 동작
- service가 DB를 직접 접근하지 않음 — repository 패턴 유지

### 5.12 Main Process — `src/main/index.ts` 수정

**변경 1**: import 추가

```typescript
import { startMcpApiServer, stopMcpApiServer } from './mcp-api/server'
import { registerAllRoutes } from './mcp-api/routes'
```

**변경 2**: `app.whenReady()` 내 — 핸들러 등록 후 MCP API 서버 시작

```typescript
// 기존 registerTerminalHandlers() 다음에 추가
registerAllRoutes()
startMcpApiServer()
```

**변경 3**: `before-quit` 핸들러에 MCP API 서버 정리 추가

```typescript
app.on('before-quit', (event) => {
  if (isQuitting) return
  event.preventDefault()
  isQuitting = true
  reminderScheduler.stop()
  terminalService.destroy()
  stopMcpApiServer() // <-- 추가
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1000))
  session.defaultSession.flushStorageData()
  Promise.race([workspaceWatcher.stop(), timeout]).finally(() => app.quit())
})
```

### 5.13 MCP Server — `src/mcp-server/lib/http-client.ts`

```typescript
import http from 'http'
import path from 'path'
import os from 'os'

const socketPath =
  process.platform === 'win32'
    ? '\\\\.\\pipe\\rally-mcp'
    : path.join(os.homedir(), '.rally', 'mcp.sock')

interface HttpResponse {
  status: number
  data: any
}

export async function mcpRequest(
  method: string,
  urlPath: string,
  body?: any
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      socketPath,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8')
        try {
          const data = JSON.parse(raw)
          resolve({ status: res.statusCode || 200, data })
        } catch {
          resolve({ status: res.statusCode || 200, data: raw })
        }
      })
    })

    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOENT') {
        reject(new Error('Rally 앱이 실행 중이 아닙니다. Rally를 먼저 실행해주세요.'))
      } else {
        reject(err)
      }
    })

    if (body) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}
```

**핵심 포인트**:

- Lazy connection: 상태 변수 없음. 매 호출마다 새 `http.request` 생성
- `ECONNREFUSED`/`ENOENT` → "Rally 앱이 실행 중이 아닙니다" 에러 메시지
- Rally 재시작 → 소켓 파일 재생성 → 다음 호출 시 자동 재연결
- **Electron import 없음** — 이 파일은 standalone Node.js 프로세스에서 실행

### 5.14 MCP Server — `src/mcp-server/index.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerAllTools } from './tools'

const server = new McpServer({
  name: 'rally',
  version: '1.0.0'
})

registerAllTools(server)

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(console.error)
```

### 5.15 MCP Server — Tool 정의 예시

#### `src/mcp-server/tools/list-workspaces.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mcpRequest } from '../lib/http-client'

export function registerListWorkspaces(server: McpServer): void {
  server.tool(
    'list_workspaces',
    'List all Rally workspaces with their names and paths',
    {},
    async () => {
      try {
        const { status, data } = await mcpRequest('GET', '/api/workspaces')
        if (status !== 200) {
          return { content: [{ type: 'text', text: `Error: ${data.error}` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
      } catch (error) {
        return {
          content: [{ type: 'text', text: (error as Error).message }],
          isError: true
        }
      }
    }
  )
}
```

#### `src/mcp-server/tools/write-note.ts`

```typescript
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mcpRequest } from '../lib/http-client'

export function registerWriteNote(server: McpServer): void {
  server.tool(
    'write_note',
    `Update the content of an existing note.
WARNING: This operation will delete any image files (![](/.images/xxx.png)) that are referenced in the old content but removed from the new content. Always preserve existing image references unless intentionally removing them.`,
    {
      workspaceId: z.string().describe('Workspace ID'),
      noteId: z.string().describe('Note ID'),
      content: z.string().describe('New markdown content (preserve existing image references)')
    },
    async ({ workspaceId, noteId, content }) => {
      try {
        const { status, data } = await mcpRequest(
          'PUT',
          `/api/workspaces/${encodeURIComponent(workspaceId)}/notes/${encodeURIComponent(noteId)}/content`,
          { content }
        )
        if (status !== 200) {
          return { content: [{ type: 'text', text: `Error: ${data.error}` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
      } catch (error) {
        return {
          content: [{ type: 'text', text: (error as Error).message }],
          isError: true
        }
      }
    }
  )
}
```

#### `src/mcp-server/tools/create-note.ts`

```typescript
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mcpRequest } from '../lib/http-client'

export function registerCreateNote(server: McpServer): void {
  server.tool(
    'create_note',
    'Create a new note in a workspace. Optionally set initial content.',
    {
      workspaceId: z.string().describe('Workspace ID'),
      folderId: z.string().optional().describe('Folder ID (omit for root level)'),
      title: z.string().describe('Note title (without .md extension)'),
      content: z.string().optional().describe('Initial markdown content')
    },
    async ({ workspaceId, folderId, title, content }) => {
      try {
        const { status, data } = await mcpRequest(
          'POST',
          `/api/workspaces/${encodeURIComponent(workspaceId)}/notes`,
          { title, folderId, content }
        )
        if (status !== 200) {
          return { content: [{ type: 'text', text: `Error: ${data.error}` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
      } catch (error) {
        return {
          content: [{ type: 'text', text: (error as Error).message }],
          isError: true
        }
      }
    }
  )
}
```

#### `src/mcp-server/tools/search-notes.ts`

```typescript
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mcpRequest } from '../lib/http-client'

export function registerSearchNotes(server: McpServer): void {
  server.tool(
    'search_notes',
    'Search notes by title or content. Returns up to 50 results. Title matches are prioritized over content matches.',
    {
      workspaceId: z.string().describe('Workspace ID'),
      query: z.string().describe('Search query (case-insensitive)')
    },
    async ({ workspaceId, query }) => {
      try {
        const { status, data } = await mcpRequest(
          'GET',
          `/api/workspaces/${encodeURIComponent(workspaceId)}/notes/search?q=${encodeURIComponent(query)}`
        )
        if (status !== 200) {
          return { content: [{ type: 'text', text: `Error: ${data.error}` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
      } catch (error) {
        return {
          content: [{ type: 'text', text: (error as Error).message }],
          isError: true
        }
      }
    }
  )
}
```

나머지 Tool (list_folders, list_notes, read_note, rename_note, move_note)도 동일한 패턴으로 구현한다. 각 Tool은:

1. `z.object`로 입력 스키마 정의
2. `mcpRequest()`로 HTTP 호출
3. `status !== 200` → `isError: true`
4. catch → Rally 미실행 에러 메시지

#### `src/mcp-server/tools/index.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerListWorkspaces } from './list-workspaces'
import { registerListFolders } from './list-folders'
import { registerListNotes } from './list-notes'
import { registerReadNote } from './read-note'
import { registerWriteNote } from './write-note'
import { registerCreateNote } from './create-note'
import { registerRenameNote } from './rename-note'
import { registerMoveNote } from './move-note'
import { registerSearchNotes } from './search-notes'

export function registerAllTools(server: McpServer): void {
  registerListWorkspaces(server)
  registerListFolders(server)
  registerListNotes(server)
  registerReadNote(server)
  registerWriteNote(server)
  registerCreateNote(server)
  registerRenameNote(server)
  registerMoveNote(server)
  registerSearchNotes(server)
}
```

### 5.16 MCP Server Build — `src/mcp-server/tsup.config.ts`

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/mcp-server/index.ts'],
  outDir: 'dist-mcp',
  format: ['cjs'],
  target: 'node18',
  clean: true,
  sourcemap: false,
  // @modelcontextprotocol/sdk, zod 등 번들에 포함
  noExternal: [/.*/],
  banner: {
    js: '#!/usr/bin/env node'
  }
})
```

**핵심 포인트**:

- 출력: `dist-mcp/index.js` (Electron 빌드 출력 `out/`과 분리)
- `noExternal: [/.*/]` — 모든 의존성 번들에 포함. Claude Desktop이 `node dist-mcp/index.js`만으로 실행 가능
- `#!/usr/bin/env node` 배너 — 직접 실행 가능
- `format: ['cjs']` — Node.js 호환성

### 5.17 package.json 수정

```json
{
  "scripts": {
    "build:mcp": "tsup --config src/mcp-server/tsup.config.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest"
  },
  "devDependencies": {
    "tsup": "latest"
  }
}
```

**참고**: `zod`는 `@modelcontextprotocol/sdk`의 peer dependency이며, Rally에 이미 설치되어 있음 (`react-hook-form` + `@hookform/resolvers/zod` 사용 중).

---

## 6. MCP Tool Descriptions (AI 가이드)

각 Tool의 `description`은 AI가 올바르게 사용할 수 있도록 명확하게 작성한다.

| Tool              | Description                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_workspaces` | List all Rally workspaces with their names and paths                                                                                                                                               |
| `list_folders`    | List all folders in a workspace. Use folder IDs for move_note.                                                                                                                                     |
| `list_notes`      | List all notes in a workspace with title, path, preview, and folder info                                                                                                                           |
| `read_note`       | Read the full markdown content of a note                                                                                                                                                           |
| `write_note`      | Update note content. **WARNING: Removing image references (![](/.images/...)) will permanently delete those image files.** Always preserve existing image tags unless intentionally removing them. |
| `create_note`     | Create a new note. Optionally set initial content. Omit folderId for root level.                                                                                                                   |
| `rename_note`     | Rename a note (changes file name on disk)                                                                                                                                                          |
| `move_note`       | Move a note to a different folder. Use null targetFolderId for root. Note is placed at the top of the target folder.                                                                               |
| `search_notes`    | Search notes by title or content (case-insensitive, max 50 results). Title matches are prioritized.                                                                                                |

---

## 7. Lifecycle Management

### 7.1 이벤트별 동작

| 이벤트                    | 동작                                                         | 안전성                                |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| Rally 시작                | `registerAllRoutes()` → `startMcpApiServer()`                | `mkdirSync` + `unlinkSync` + `listen` |
| MCP Tool 호출             | MCP 서버 → `mcpRequest()` → UDS HTTP → router → handler      | Lazy, 상태 없음                       |
| 쓰기 Tool 호출            | handler → service → `broadcastChanged()` → Renderer re-fetch | 2중 push 가능하나 부작용 없음         |
| Rally 종료                | `stopMcpApiServer()` → `server.close()` + `unlinkSync`       | `before-quit`에서 동기적 호출         |
| Rally 비정상 종료         | 소켓 파일 남음                                               | 다음 시작 시 `unlinkSync` 후 재생성   |
| Rally 미실행 시 Tool 호출 | `ECONNREFUSED`/`ENOENT` → 에러 반환                          | "Rally 앱이 실행 중이 아닙니다"       |
| Rally 이후 실행           | 다음 Tool 호출 시 자동 연결                                  | Lazy connection, 재시도 불필요        |

### 7.2 서버 시작 시퀀스

```
app.whenReady()
  → runMigrations()
  → initializeDatabase()
  → register*Handlers() (기존 IPC)
  → registerAllRoutes()          // <-- 새로 추가
  → startMcpApiServer()          // <-- 새로 추가
  → createWindow()
  → reminderScheduler.start()
```

### 7.3 서버 종료 시퀀스

```
before-quit
  → reminderScheduler.stop()
  → terminalService.destroy()
  → stopMcpApiServer()           // <-- 새로 추가
  → flushStorageData()
  → workspaceWatcher.stop() || timeout
  → app.quit()
```

---

## 8. Dependencies

### 8.1 New Packages

| Package                     | Layer      | Purpose                                   |
| --------------------------- | ---------- | ----------------------------------------- |
| `@modelcontextprotocol/sdk` | mcp-server | MCP 서버 SDK (stdio transport, Tool 정의) |
| `tsup`                      | devDep     | MCP 서버 독립 빌드 번들러                 |

### 8.2 Existing Packages Used

| Package          | Layer      | Usage                                   |
| ---------------- | ---------- | --------------------------------------- |
| `zod`            | mcp-server | MCP Tool 입력 스키마 정의 (이미 설치됨) |
| `drizzle-orm`    | main       | `like()` 검색 쿼리 (noteService.search) |
| `better-sqlite3` | main       | DB 접근 (기존)                          |

---

## 9. Implementation Order

| Step | File(s)                                | Description                                                       |
| ---- | -------------------------------------- | ----------------------------------------------------------------- |
| 1    | `package.json`                         | `npm install @modelcontextprotocol/sdk` + `npm install -D tsup`   |
| 2    | `src/main/mcp-api/lib/body-parser.ts`  | JSON body 파서 (10MB 제한)                                        |
| 3    | `src/main/mcp-api/lib/broadcast.ts`    | broadcastChanged 유틸                                             |
| 4    | `src/main/mcp-api/router.ts`           | URL 패턴 매칭 + 에러 핸들링                                       |
| 5    | `src/main/mcp-api/routes/workspace.ts` | GET /api/workspaces                                               |
| 6    | `src/main/mcp-api/routes/folder.ts`    | GET /api/workspaces/:wsId/folders                                 |
| 7    | `src/main/mcp-api/routes/search.ts`    | GET /api/workspaces/:wsId/notes/search                            |
| 8    | `src/main/mcp-api/routes/note.ts`      | 6개 note 엔드포인트                                               |
| 9    | `src/main/mcp-api/routes/index.ts`     | 라우트 등록 (search 먼저)                                         |
| 10   | `src/main/repositories/note.ts`        | `searchByTitle()` 메서드 추가                                     |
| 11   | `src/main/services/note.ts`            | `search()` 메서드 추가                                            |
| 12   | `src/main/mcp-api/server.ts`           | UDS HTTP 서버 start/stop                                          |
| 13   | `src/main/index.ts`                    | import + registerAllRoutes + startMcpApiServer + stopMcpApiServer |
| 14   | `src/mcp-server/lib/http-client.ts`    | UDS HTTP 클라이언트                                               |
| 15   | `src/mcp-server/tools/*.ts`            | 9개 MCP Tool 정의                                                 |
| 16   | `src/mcp-server/tools/index.ts`        | Tool 등록 barrel                                                  |
| 17   | `src/mcp-server/index.ts`              | MCP 서버 엔트리포인트                                             |
| 18   | `src/mcp-server/tsup.config.ts`        | 빌드 설정                                                         |
| 19   | `package.json`                         | `build:mcp` 스크립트 추가                                         |

---

## 10. File Change Summary

### 10.1 New Files (22)

| File                                      | Layer               |
| ----------------------------------------- | ------------------- |
| `src/main/mcp-api/server.ts`              | main/mcp-api        |
| `src/main/mcp-api/router.ts`              | main/mcp-api        |
| `src/main/mcp-api/lib/body-parser.ts`     | main/mcp-api/lib    |
| `src/main/mcp-api/lib/broadcast.ts`       | main/mcp-api/lib    |
| `src/main/mcp-api/routes/workspace.ts`    | main/mcp-api/routes |
| `src/main/mcp-api/routes/folder.ts`       | main/mcp-api/routes |
| `src/main/mcp-api/routes/note.ts`         | main/mcp-api/routes |
| `src/main/mcp-api/routes/search.ts`       | main/mcp-api/routes |
| `src/main/mcp-api/routes/index.ts`        | main/mcp-api/routes |
| `src/mcp-server/index.ts`                 | mcp-server          |
| `src/mcp-server/lib/http-client.ts`       | mcp-server/lib      |
| `src/mcp-server/tools/list-workspaces.ts` | mcp-server/tools    |
| `src/mcp-server/tools/list-folders.ts`    | mcp-server/tools    |
| `src/mcp-server/tools/list-notes.ts`      | mcp-server/tools    |
| `src/mcp-server/tools/read-note.ts`       | mcp-server/tools    |
| `src/mcp-server/tools/write-note.ts`      | mcp-server/tools    |
| `src/mcp-server/tools/create-note.ts`     | mcp-server/tools    |
| `src/mcp-server/tools/rename-note.ts`     | mcp-server/tools    |
| `src/mcp-server/tools/move-note.ts`       | mcp-server/tools    |
| `src/mcp-server/tools/search-notes.ts`    | mcp-server/tools    |
| `src/mcp-server/tools/index.ts`           | mcp-server/tools    |
| `src/mcp-server/tsup.config.ts`           | mcp-server          |

### 10.2 Modified Files (4)

| File                            | Changes                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/main/index.ts`             | import 2개 + `registerAllRoutes()` + `startMcpApiServer()` + `stopMcpApiServer()` in before-quit |
| `src/main/repositories/note.ts` | `searchByTitle()` 메서드 추가 + `and`, `like` import 추가                                        |
| `src/main/services/note.ts`     | `search()` async 메서드 추가 (repository 패턴 사용)                                              |
| `package.json`                  | dependencies + devDependencies + `build:mcp` script                                              |

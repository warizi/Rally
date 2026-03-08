# MCP Server Refactoring Design Document

> **Summary**: MCP 서버의 코드 중복 제거 + 구조 개선. 9개 Tool 파일을 단일 선언적 파일로 통합하고, HTTP API Router를 인스턴스 기반으로 전환한다. 기능/동작 변경 없이 순수 리펙토링.
>
> **Date**: 2026-03-07
> **Status**: Draft
> **Planning Doc**: [mcp-server-refactoring.plan.md](../../01-plan/features/mcp-server-refactoring.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- MCP Tool 9개 파일의 보일러플레이트 제거 → `callTool()` 공통 유틸 + 선언적 config 배열
- Router 전역 상태 제거 → `createRouter()` 팩토리 함수
- 에러 타입 통합 → `PayloadTooLargeError`를 `errors.ts`로 이동
- Route 핸들러 body 타입 안전성 강화 → `addRoute<TBody>` 제네릭

### 1.2 Design Principles

- **기능 동일** — Tool name, description, schema, HTTP 매핑이 정확히 동일해야 함
- **외부 API 유지** — `startMcpApiServer()` / `stopMcpApiServer()` 시그니처 불변
- **SDK 타입 활용** — `CallToolResult`를 SDK에서 직접 import (로컬 타입 정의 금지)

---

## 2. Architecture

### 2.1 변경 전 구조

```
src/mcp-server/
  index.ts                    ← stdio entry
  lib/http-client.ts          ← UDS HTTP 클라이언트
  tools/                      ← 10개 파일 (9 tool + index.ts)
    index.ts                  ← barrel: 9개 import + 9개 호출
    list-workspaces.ts        ← try-catch 보일러플레이트
    list-folders.ts           ← 동일 보일러플레이트
    list-notes.ts             ← 동일
    read-note.ts              ← 동일
    write-note.ts             ← 동일
    create-note.ts            ← 동일
    rename-note.ts            ← 동일
    move-note.ts              ← 동일
    search-notes.ts           ← 동일

src/main/mcp-api/
  server.ts                   ← http.createServer(router)
  router.ts                   ← 전역 routes[], addRoute(), router()
  routes/
    index.ts                  ← registerAllRoutes()
    workspace.ts              ← addRoute(...) 직접 호출
    folder.ts                 ← addRoute(...) 직접 호출
    note.ts                   ← addRoute(...) 직접 호출, body: any
    search.ts                 ← addRoute(...) 직접 호출
  lib/
    body-parser.ts            ← PayloadTooLargeError 정의
    broadcast.ts
```

### 2.2 변경 후 구조

```
src/mcp-server/
  index.ts                    ← stdio entry (import 경로만 변경)
  lib/
    http-client.ts            ← (변경 없음)
    call-tool.ts              ← [NEW] callTool() 공통 유틸
  tool-definitions.ts         ← [NEW] 9개 Tool 선언적 정의
  (tools/ 디렉토리 삭제)

src/main/mcp-api/
  server.ts                   ← 내부에서 createRouter() + registerAllRoutes(router)
  router.ts                   ← createRouter() 팩토리, addRoute<TBody> 제네릭
  routes/
    index.ts                  ← registerAllRoutes(router: Router)
    workspace.ts              ← registerWorkspaceRoutes(router: Router)
    folder.ts                 ← registerFolderRoutes(router: Router)
    note.ts                   ← registerNoteRoutes(router: Router), body 타입 제네릭
    search.ts                 ← registerSearchRoutes(router: Router)
  lib/
    body-parser.ts            ← PayloadTooLargeError import from errors.ts
    broadcast.ts              ← (변경 없음)

src/main/lib/
  errors.ts                   ← PayloadTooLargeError 추가
```

---

## 3. Implementation Details

### 3.1 `src/mcp-server/lib/call-tool.ts` — [NEW]

```typescript
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { mcpRequest } from './http-client'

export async function callTool(
  method: string,
  urlPath: string,
  body?: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    const { status, data } = await mcpRequest(method, urlPath, body)
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
```

### 3.2 `src/mcp-server/tool-definitions.ts` — [NEW]

9개 Tool의 고유 정보(name, description, schema, HTTP 매핑)만 선언적으로 정의한다.

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { callTool } from './lib/call-tool'

interface ToolDefinition {
  name: string
  description: string
  schema: Record<string, z.ZodType>
  handler: (args: Record<string, any>) => Promise<CallToolResult>
}

const enc = encodeURIComponent

const tools: ToolDefinition[] = [
  {
    name: 'list_workspaces',
    description: 'List all Rally workspaces with their names and paths',
    schema: {},
    handler: () => callTool('GET', '/api/workspaces')
  },
  {
    name: 'list_folders',
    description: 'List all folders in a workspace. Use folder IDs for move_note.',
    schema: {
      workspaceId: z.string().describe('Workspace ID')
    },
    handler: ({ workspaceId }) => callTool('GET', `/api/workspaces/${enc(workspaceId)}/folders`)
  },
  {
    name: 'list_notes',
    description: 'List all notes in a workspace with title, path, preview, and folder info',
    schema: {
      workspaceId: z.string().describe('Workspace ID')
    },
    handler: ({ workspaceId }) => callTool('GET', `/api/workspaces/${enc(workspaceId)}/notes`)
  },
  {
    name: 'read_note',
    description: 'Read the full markdown content of a note',
    schema: {
      workspaceId: z.string().describe('Workspace ID'),
      noteId: z.string().describe('Note ID')
    },
    handler: ({ workspaceId, noteId }) =>
      callTool('GET', `/api/workspaces/${enc(workspaceId)}/notes/${enc(noteId)}/content`)
  },
  {
    name: 'write_note',
    description: `Update the content of an existing note.
WARNING: This operation will delete any image files (![](/.images/xxx.png)) that are referenced in the old content but removed from the new content. Always preserve existing image references unless intentionally removing them.`,
    schema: {
      workspaceId: z.string().describe('Workspace ID'),
      noteId: z.string().describe('Note ID'),
      content: z.string().describe('New markdown content (preserve existing image references)')
    },
    handler: ({ workspaceId, noteId, content }) =>
      callTool('PUT', `/api/workspaces/${enc(workspaceId)}/notes/${enc(noteId)}/content`, {
        content
      })
  },
  {
    name: 'create_note',
    description: 'Create a new note in a workspace. Optionally set initial content.',
    schema: {
      workspaceId: z.string().describe('Workspace ID'),
      folderId: z.string().optional().describe('Folder ID (omit for root level)'),
      title: z.string().describe('Note title (without .md extension)'),
      content: z.string().optional().describe('Initial markdown content')
    },
    handler: ({ workspaceId, folderId, title, content }) =>
      callTool('POST', `/api/workspaces/${enc(workspaceId)}/notes`, {
        title,
        folderId,
        content
      })
  },
  {
    name: 'rename_note',
    description: 'Rename a note (changes file name on disk)',
    schema: {
      workspaceId: z.string().describe('Workspace ID'),
      noteId: z.string().describe('Note ID'),
      newName: z.string().describe('New note name (without .md extension)')
    },
    handler: ({ workspaceId, noteId, newName }) =>
      callTool('PATCH', `/api/workspaces/${enc(workspaceId)}/notes/${enc(noteId)}/rename`, {
        newName
      })
  },
  {
    name: 'move_note',
    description:
      'Move a note to a different folder. Use null targetFolderId for root. Note is placed at the top of the target folder.',
    schema: {
      workspaceId: z.string().describe('Workspace ID'),
      noteId: z.string().describe('Note ID'),
      targetFolderId: z.string().optional().describe('Target folder ID (omit for root level)')
    },
    handler: ({ workspaceId, noteId, targetFolderId }) =>
      callTool('PATCH', `/api/workspaces/${enc(workspaceId)}/notes/${enc(noteId)}/move`, {
        targetFolderId
      })
  },
  {
    name: 'search_notes',
    description:
      'Search notes by title or content. Returns up to 50 results. Title matches are prioritized over content matches.',
    schema: {
      workspaceId: z.string().describe('Workspace ID'),
      query: z.string().describe('Search query (case-insensitive)')
    },
    handler: ({ workspaceId, query }) =>
      callTool('GET', `/api/workspaces/${enc(workspaceId)}/notes/search?q=${enc(query)}`)
  }
]

export function registerAllTools(server: McpServer): void {
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.schema, tool.handler as any)
  }
}
```

**검증 사항** (기존 코드와 1:1 대조 완료):

- `list_workspaces`: schema `{}`, GET `/api/workspaces` — 일치
- `list_folders`: schema `{ workspaceId }`, GET `.../folders` — 일치
- `list_notes`: schema `{ workspaceId }`, GET `.../notes` — 일치
- `read_note`: schema `{ workspaceId, noteId }`, GET `.../content` — 일치
- `write_note`: schema `{ workspaceId, noteId, content }`, PUT `.../content`, body `{ content }`, description에 이미지 WARNING 포함 — 일치
- `create_note`: schema `{ workspaceId, folderId?, title, content? }`, POST `.../notes`, body `{ title, folderId, content }` — 일치
- `rename_note`: schema `{ workspaceId, noteId, newName }`, PATCH `.../rename`, body `{ newName }` — 일치
- `move_note`: schema `{ workspaceId, noteId, targetFolderId? }`, PATCH `.../move`, body `{ targetFolderId }` — 일치
- `search_notes`: schema `{ workspaceId, query }`, GET `.../search?q=...` — 일치

### 3.3 `src/mcp-server/index.ts` — MODIFY

```typescript
// Before
import { registerAllTools } from './tools'

// After
import { registerAllTools } from './tool-definitions'
```

나머지 코드(McpServer 생성, StdioServerTransport, main())는 변경 없음.

### 3.4 `src/main/lib/errors.ts` — MODIFY

```typescript
// 기존 3개 에러 클래스 뒤에 추가
export class PayloadTooLargeError extends Error {
  constructor() {
    super('Request body too large (max 10MB)')
    this.name = 'PayloadTooLargeError'
  }
}
```

### 3.5 `src/main/mcp-api/lib/body-parser.ts` — MODIFY

```typescript
// Before
import { ValidationError } from '../../lib/errors'

const MAX_BODY_SIZE = 10 * 1024 * 1024

export class PayloadTooLargeError extends Error {
  constructor() {
    super('Request body too large (max 10MB)')
    this.name = 'PayloadTooLargeError'
  }
}

// After
import { ValidationError, PayloadTooLargeError } from '../../lib/errors'

const MAX_BODY_SIZE = 10 * 1024 * 1024

// PayloadTooLargeError class 제거 — errors.ts에서 import
```

나머지 `parseBody()` 함수는 변경 없음.

### 3.6 `src/main/mcp-api/router.ts` — MODIFY (전면 재작성)

```typescript
import http from 'http'
import { parseBody } from './lib/body-parser'
import { NotFoundError, ValidationError, ConflictError, PayloadTooLargeError } from '../lib/errors'

type RouteParams = Record<string, string>

interface Route {
  method: string
  pattern: RegExp
  paramNames: string[]
  handler: (params: RouteParams, body: any, query: URLSearchParams) => any | Promise<any>
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

export function createRouter() {
  const routes: Route[] = []

  function addRoute<TBody = null>(
    method: string,
    pathPattern: string,
    handler: (params: RouteParams, body: TBody, query: URLSearchParams) => any | Promise<any>
  ): void {
    const paramNames: string[] = []
    const regexStr = pathPattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name)
      return '([^/]+)'
    })
    routes.push({
      method,
      pattern: new RegExp(`^${regexStr}$`),
      paramNames,
      handler: handler as Route['handler']
    })
  }

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const urlObj = new URL(req.url || '/', 'http://localhost')
    const pathname = urlObj.pathname
    const query = urlObj.searchParams
    const method = req.method || 'GET'

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

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not Found', errorType: 'NotFoundError' }))
  }

  return { addRoute, handle }
}

export type Router = ReturnType<typeof createRouter>
```

**변경 요약**:

- `routes` 배열이 `createRouter()` 클로저 내부로 이동 → 전역 상태 제거
- `addRoute()`에 `<TBody>` 제네릭 추가 — handler의 body 파라미터에 타입 전달
- `addRoute()` 내부에서 `handler as Route['handler']`로 캐스팅 — `Route.handler`는 `any` body이므로 제네릭 handler를 안전하게 저장
- `router()` → `handle()` 이름 변경 (export 대신 클로저 반환)
- `mapErrorToStatus()`, `mapErrorToType()`은 모듈 레벨 유지 (인스턴스별 변경 없음)
- `PayloadTooLargeError` import 경로: `'./lib/body-parser'` → `'../lib/errors'`

### 3.7 `src/main/mcp-api/routes/workspace.ts` — MODIFY

```typescript
// Before
import { addRoute } from '../router'
import { workspaceRepository } from '../../repositories/workspace'

export function registerWorkspaceRoutes(): void {
  addRoute('GET', '/api/workspaces', () => {

// After
import type { Router } from '../router'
import { workspaceRepository } from '../../repositories/workspace'

export function registerWorkspaceRoutes(router: Router): void {
  router.addRoute('GET', '/api/workspaces', () => {
```

나머지 핸들러 로직은 변경 없음.

### 3.8 `src/main/mcp-api/routes/folder.ts` — MODIFY

```typescript
// Before
import { addRoute } from '../router'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { NotFoundError } from '../../lib/errors'

export function registerFolderRoutes(): void {
  addRoute('GET', '/api/workspaces/:wsId/folders', (params) => {

// After
import type { Router } from '../router'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { NotFoundError } from '../../lib/errors'

export function registerFolderRoutes(router: Router): void {
  router.addRoute('GET', '/api/workspaces/:wsId/folders', (params) => {
```

나머지 핸들러 로직은 변경 없음.

### 3.9 `src/main/mcp-api/routes/search.ts` — MODIFY

```typescript
// Before
import { addRoute } from '../router'
import { noteService } from '../../services/note'

export function registerSearchRoutes(): void {
  addRoute('GET', '/api/workspaces/:wsId/notes/search', async (params, _body, query) => {

// After
import type { Router } from '../router'
import { noteService } from '../../services/note'

export function registerSearchRoutes(router: Router): void {
  router.addRoute('GET', '/api/workspaces/:wsId/notes/search', async (params, _body, query) => {
```

나머지 핸들러 로직은 변경 없음.

### 3.10 `src/main/mcp-api/routes/note.ts` — MODIFY

```typescript
// Before
import { addRoute } from '../router'
import { noteService } from '../../services/note'
import { noteRepository } from '../../repositories/note'
import { folderRepository } from '../../repositories/folder'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { broadcastChanged } from '../lib/broadcast'

function requireBody(body: any): asserts body is Record<string, any> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required')
  }
}

export function registerNoteRoutes(): void {
  // GET /api/workspaces/:wsId/notes
  addRoute('GET', '/api/workspaces/:wsId/notes', (params) => {
    // ...
  })

  // GET /api/workspaces/:wsId/notes/:noteId/content
  addRoute('GET', '/api/workspaces/:wsId/notes/:noteId/content', (params) => {
    // ...
  })

  // PUT /api/workspaces/:wsId/notes/:noteId/content
  addRoute('PUT', '/api/workspaces/:wsId/notes/:noteId/content', (params, body) => {
    requireBody(body)
    // body.content — any
    // ...
  })

  // POST /api/workspaces/:wsId/notes
  addRoute('POST', '/api/workspaces/:wsId/notes', (params, body) => {
    requireBody(body)
    // body.title, body.folderId, body.content — any
    // ...
  })

  // PATCH /api/workspaces/:wsId/notes/:noteId/rename
  addRoute('PATCH', '/api/workspaces/:wsId/notes/:noteId/rename', (params, body) => {
    requireBody(body)
    // body.newName — any
    // ...
  })

  // PATCH /api/workspaces/:wsId/notes/:noteId/move
  addRoute('PATCH', '/api/workspaces/:wsId/notes/:noteId/move', (params, body) => {
    requireBody(body)
    // body.targetFolderId — any
    // ...
  })
}

// After
import type { Router } from '../router'
import { noteService } from '../../services/note'
import { noteRepository } from '../../repositories/note'
import { folderRepository } from '../../repositories/folder'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { broadcastChanged } from '../lib/broadcast'

function requireBody(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required')
  }
}

export function registerNoteRoutes(router: Router): void {
  // GET /api/workspaces/:wsId/notes
  router.addRoute('GET', '/api/workspaces/:wsId/notes', (params) => {
    // ... (기존 로직 동일)
  })

  // GET /api/workspaces/:wsId/notes/:noteId/content
  router.addRoute('GET', '/api/workspaces/:wsId/notes/:noteId/content', (params) => {
    // ... (기존 로직 동일)
  })

  // PUT /api/workspaces/:wsId/notes/:noteId/content
  router.addRoute<{ content: string }>(
    'PUT',
    '/api/workspaces/:wsId/notes/:noteId/content',
    (params, body) => {
      requireBody(body)
      const note = noteRepository.findById(params.noteId)
      if (!note) throw new NotFoundError(`Note not found: ${params.noteId}`)

      noteService.writeContent(params.wsId, params.noteId, body.content)
      broadcastChanged('note:changed', params.wsId, [note.relativePath])

      return { success: true, title: note.title, relativePath: note.relativePath }
    }
  )

  // POST /api/workspaces/:wsId/notes
  router.addRoute<{ title: string; folderId?: string; content?: string }>(
    'POST',
    '/api/workspaces/:wsId/notes',
    (params, body) => {
      requireBody(body)
      const folderId = body.folderId ?? null
      const result = noteService.create(params.wsId, folderId, body.title)

      try {
        if (body.content) {
          noteService.writeContent(params.wsId, result.id, body.content)
        }
      } finally {
        broadcastChanged('note:changed', params.wsId, [result.relativePath])
      }

      return { id: result.id, title: result.title, relativePath: result.relativePath }
    }
  )

  // PATCH /api/workspaces/:wsId/notes/:noteId/rename
  router.addRoute<{ newName: string }>(
    'PATCH',
    '/api/workspaces/:wsId/notes/:noteId/rename',
    (params, body) => {
      requireBody(body)
      const oldNote = noteRepository.findById(params.noteId)
      if (!oldNote) throw new NotFoundError(`Note not found: ${params.noteId}`)

      const result = noteService.rename(params.wsId, params.noteId, body.newName)
      broadcastChanged('note:changed', params.wsId, [oldNote.relativePath, result.relativePath])

      return { id: result.id, title: result.title, relativePath: result.relativePath }
    }
  )

  // PATCH /api/workspaces/:wsId/notes/:noteId/move
  router.addRoute<{ targetFolderId?: string }>(
    'PATCH',
    '/api/workspaces/:wsId/notes/:noteId/move',
    (params, body) => {
      requireBody(body)
      const oldNote = noteRepository.findById(params.noteId)
      if (!oldNote) throw new NotFoundError(`Note not found: ${params.noteId}`)

      const targetFolderId = body.targetFolderId ?? null
      const result = noteService.move(params.wsId, params.noteId, targetFolderId, 0)
      broadcastChanged('note:changed', params.wsId, [oldNote.relativePath, result.relativePath])

      return {
        id: result.id,
        title: result.title,
        relativePath: result.relativePath,
        folderId: result.folderId
      }
    }
  )
}
```

**변경 요약**:

- `addRoute` → `router.addRoute`
- `registerNoteRoutes()` → `registerNoteRoutes(router: Router)`
- PUT/POST/PATCH 핸들러에 body 타입 제네릭 적용
- `requireBody` 파라미터: `any` → `unknown` (더 안전)
- `requireBody` assertion은 `TBody` 제네릭과 intersection되어 body 타입이 유지됨 (예: `{ content: string } & Record<string, unknown>` → `body.content`는 `string`)
- 핸들러 내부 로직은 완전히 동일

### 3.11 `src/main/mcp-api/routes/index.ts` — MODIFY

```typescript
// Before
import { registerWorkspaceRoutes } from './workspace'
import { registerFolderRoutes } from './folder'
import { registerNoteRoutes } from './note'
import { registerSearchRoutes } from './search'

export function registerAllRoutes(): void {
  registerWorkspaceRoutes()
  registerFolderRoutes()
  registerSearchRoutes()
  registerNoteRoutes()
}

// After
import type { Router } from '../router'
import { registerWorkspaceRoutes } from './workspace'
import { registerFolderRoutes } from './folder'
import { registerNoteRoutes } from './note'
import { registerSearchRoutes } from './search'

export function registerAllRoutes(router: Router): void {
  registerWorkspaceRoutes(router)
  registerFolderRoutes(router)
  // search를 note보다 먼저 등록 (URL 매칭 순서 유지)
  registerSearchRoutes(router)
  registerNoteRoutes(router)
}
```

### 3.12 `src/main/mcp-api/server.ts` — MODIFY

```typescript
// Before
import http from 'http'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { router } from './router'

const socketPath = ...
let server: http.Server | null = null

export function startMcpApiServer(): void {
  // ...
  server = http.createServer(router)
  server.listen(socketPath, () => { ... })
}

// After
import http from 'http'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { createRouter } from './router'
import { registerAllRoutes } from './routes'

const socketPath =
  process.platform === 'win32'
    ? '\\\\.\\pipe\\rally-mcp'
    : path.join(os.homedir(), '.rally', 'mcp.sock')

let server: http.Server | null = null

export function startMcpApiServer(): void {
  if (process.platform !== 'win32') {
    const dir = path.dirname(socketPath)
    fs.mkdirSync(dir, { recursive: true })
  }

  try {
    fs.unlinkSync(socketPath)
  } catch {
    // 파일 없으면 무시
  }

  const router = createRouter()
  registerAllRoutes(router)

  server = http.createServer(router.handle)
  server.listen(socketPath, () => {
    console.log(`[MCP API] Listening on ${socketPath}`)
  })
}

export function stopMcpApiServer(): void {
  if (server) {
    server.close()
    server = null
  }
  try {
    fs.unlinkSync(socketPath)
  } catch {
    // 무시
  }
}
```

**변경 요약**:

- `import { router } from './router'` → `import { createRouter } from './router'` + `import { registerAllRoutes } from './routes'`
- `startMcpApiServer()` 내부에서 `createRouter()` + `registerAllRoutes(router)` 수행
- `http.createServer(router)` → `http.createServer(router.handle)`
- `stopMcpApiServer()`는 변경 없음

### 3.13 `src/main/index.ts` — MODIFY

```typescript
// Before
import { startMcpApiServer, stopMcpApiServer } from './mcp-api/server'
import { registerAllRoutes } from './mcp-api/routes'

// app.whenReady() 내부:
registerAllRoutes()
startMcpApiServer()

// After
import { startMcpApiServer, stopMcpApiServer } from './mcp-api/server'
// registerAllRoutes import 제거

// app.whenReady() 내부:
startMcpApiServer()
// registerAllRoutes() 호출 제거
```

---

## 4. File Change Summary

### 4.1 New Files (2)

| File                                 | Lines (approx) |
| ------------------------------------ | -------------- |
| `src/mcp-server/lib/call-tool.ts`    | ~20            |
| `src/mcp-server/tool-definitions.ts` | ~120           |

### 4.2 Modified Files (11)

| File                                   | Change Type                                                   |
| -------------------------------------- | ------------------------------------------------------------- |
| `src/main/lib/errors.ts`               | `PayloadTooLargeError` class 추가                             |
| `src/main/mcp-api/lib/body-parser.ts`  | `PayloadTooLargeError` class 제거, import 변경                |
| `src/main/mcp-api/router.ts`           | 전면 재작성 → `createRouter()` 팩토리                         |
| `src/main/mcp-api/server.ts`           | import 변경 + 내부에서 router 생성/등록                       |
| `src/main/mcp-api/routes/index.ts`     | 시그니처 `(router: Router)` + router 전달                     |
| `src/main/mcp-api/routes/workspace.ts` | 시그니처 `(router: Router)` + `router.addRoute`               |
| `src/main/mcp-api/routes/folder.ts`    | 시그니처 `(router: Router)` + `router.addRoute`               |
| `src/main/mcp-api/routes/search.ts`    | 시그니처 `(router: Router)` + `router.addRoute`               |
| `src/main/mcp-api/routes/note.ts`      | 시그니처 `(router: Router)` + `router.addRoute` + body 제네릭 |
| `src/main/index.ts`                    | `registerAllRoutes` import/호출 제거                          |
| `src/mcp-server/index.ts`              | import 경로 `'./tools'` → `'./tool-definitions'`              |

### 4.2.1 Unchanged Files (확인 완료)

| File                                | Reason                                                   |
| ----------------------------------- | -------------------------------------------------------- |
| `src/mcp-server/tsup.config.ts`     | entry point `src/mcp-server/index.ts` 동일 — 변경 불필요 |
| `src/mcp-server/lib/http-client.ts` | 변경 없음                                                |
| `src/main/mcp-api/lib/broadcast.ts` | 변경 없음                                                |

### 4.3 Deleted Files (10)

| File                                      |
| ----------------------------------------- |
| `src/mcp-server/tools/list-workspaces.ts` |
| `src/mcp-server/tools/list-folders.ts`    |
| `src/mcp-server/tools/list-notes.ts`      |
| `src/mcp-server/tools/read-note.ts`       |
| `src/mcp-server/tools/write-note.ts`      |
| `src/mcp-server/tools/create-note.ts`     |
| `src/mcp-server/tools/rename-note.ts`     |
| `src/mcp-server/tools/move-note.ts`       |
| `src/mcp-server/tools/search-notes.ts`    |
| `src/mcp-server/tools/index.ts`           |

---

## 5. Implementation Order

### Block A: MCP Server (src/mcp-server/) — Tool 통합

| Step | Files                                     |
| ---- | ----------------------------------------- |
| A-1  | `src/mcp-server/lib/call-tool.ts` 생성    |
| A-2  | `src/mcp-server/tool-definitions.ts` 생성 |
| A-3  | `src/mcp-server/index.ts` import 변경     |
| A-4  | `src/mcp-server/tools/` 디렉토리 삭제     |
| A-5  | `npm run build:mcp` 확인                  |

### Block B: MCP API (src/main/mcp-api/) — Router + 에러 정리

| Step | Files                                                                       |
| ---- | --------------------------------------------------------------------------- |
| B-1  | `src/main/lib/errors.ts` + `src/main/mcp-api/lib/body-parser.ts`            |
| B-2  | `src/main/mcp-api/router.ts` 재작성                                         |
| B-3  | `src/main/mcp-api/routes/workspace.ts`, `folder.ts`, `search.ts`, `note.ts` |
| B-4  | `src/main/mcp-api/routes/index.ts`                                          |
| B-5  | `src/main/mcp-api/server.ts`                                                |
| B-6  | `src/main/index.ts`                                                         |
| B-7  | `npm run typecheck` 확인                                                    |

---

## 6. Verification Checklist

| #   | Check                                                                       |
| --- | --------------------------------------------------------------------------- |
| 1   | 9개 Tool의 name이 기존과 동일한가                                           |
| 2   | 9개 Tool의 description이 기존과 동일한가 (write_note의 이미지 WARNING 포함) |
| 3   | 9개 Tool의 zod schema가 기존과 동일한가 (optional/describe 포함)            |
| 4   | 9개 Tool의 HTTP method + URL 패턴이 기존과 동일한가                         |
| 5   | 9개 Tool의 body 필드 구성이 기존과 동일한가                                 |
| 6   | search route가 note route보다 먼저 등록되는가                               |
| 7   | `startMcpApiServer()` / `stopMcpApiServer()` 시그니처가 유지되는가          |
| 8   | `npm run build:mcp` 통과하는가                                              |
| 9   | `npm run typecheck` 통과하는가                                              |

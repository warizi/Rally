# Plan: MCP Server Refactoring

## 1. Overview

기존 MCP 서버 구현(`src/mcp-server/`, `src/main/mcp-api/`)의 코드 중복을 제거하고 구조를 개선한다. 2-계층 프록시 아키텍처(UDS HTTP)와 기능은 유지하면서, 반복 패턴 추출과 모듈 구조 정리에 집중한다.

**핵심 원칙**:
- 기존 기능과 동작을 변경하지 않는다 (순수 리펙토링)
- 아키텍처(MCP Server → UDS HTTP → Electron Main)는 유지
- 코드 중복 제거 + 타입 안전성 강화 + 모듈 응집도 향상

## 2. Goals

| # | Goal | Priority |
|---|------|----------|
| G-1 | MCP Tool 9개 파일의 반복 패턴(try-catch, mcpRequest, isError) 공통 유틸 추출 | Must |
| G-2 | MCP Tool 등록을 선언적 방식으로 전환 (1 Tool = 1 config 객체) | Must |
| G-3 | HTTP API router의 전역 상태(`routes` 배열) 제거 — 인스턴스 기반으로 전환 | Should |
| G-4 | HTTP API route 핸들러의 body 타입 안전성 강화 (any → typed) | Should |
| G-5 | 에러 타입 통합 — `PayloadTooLargeError`를 `src/main/lib/errors.ts`로 이동 | Should |
| G-6 | MCP Tool 파일 9개 → 단일 파일 통합 (각 Tool이 config 객체 하나이므로) | Could |
| G-7 | `server.tool()` deprecated API → `registerTool()` 전환 | Could |

## 3. Current Problems

### 3.1 MCP Tool 코드 중복 (src/mcp-server/tools/)

9개 Tool 파일이 **동일한 보일러플레이트**를 반복한다:

```typescript
// 모든 Tool에서 반복되는 패턴 (약 15줄)
async () => {
  try {
    const { status, data } = await mcpRequest(METHOD, URL)
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

**문제**: 9개 파일 × ~15줄 = ~135줄의 중복. 에러 처리 방식 변경 시 9곳 수정 필요.

### 3.2 Tool 등록 방식의 비효율

각 Tool이 별도 파일 + `register*` 함수로 분리되어 있어:
- 파일 11개 (9 tool + index.ts + http-client.ts)
- import 9개 + 호출 9개 = barrel export 18줄
- Tool 추가 시 파일 생성 + index.ts import/호출 추가 필요

실제로 각 Tool의 **고유 로직**은 tool name, description, schema, HTTP method/path 매핑뿐이며, 나머지는 모두 동일하다.

### 3.3 Router 전역 상태

`src/main/mcp-api/router.ts`의 `routes` 배열이 모듈 레벨 전역 상태:

```typescript
const routes: Route[] = []  // 모듈 전역 — addRoute()로만 수정

export function addRoute(...) { routes.push(...) }
```

**문제**: 테스트 시 초기화 불가, 여러 서버 인스턴스 생성 불가, 라우트 등록 순서가 import 순서에 의존.

### 3.4 Body 타입 안전성 부재

Route 핸들러의 body가 `any` 타입:

```typescript
type RouteHandler = (params: RouteParams, body: any, query: URLSearchParams) => any
```

`requireBody()`로 런타임 체크는 하지만, 이후에도 `body.content`, `body.title` 등을 타입 없이 접근한다.

### 3.5 에러 타입 분산

`PayloadTooLargeError`만 `body-parser.ts`에 정의되어 있고, 나머지 에러(`NotFoundError`, `ValidationError`, `ConflictError`)는 `src/main/lib/errors.ts`에 있다. 에러 타입이 2곳에 분산.

## 4. Scope

### 4.1 In Scope

| Item | Description |
|------|-------------|
| Tool 핸들러 공통화 | `callTool()` 유틸 — mcpRequest + 에러 처리 + MCP 응답 포맷 통합 |
| Tool 선언적 등록 | Tool 정의를 config 객체 배열로 전환 |
| Tool 파일 통합 | 9개 개별 파일 → `tool-definitions.ts` 단일 파일 |
| Router 인스턴스화 | `createRouter()` 팩토리 함수로 전환 |
| Body 타입 강화 | route 핸들러에서 typed body 사용 |
| 에러 타입 통합 | `PayloadTooLargeError`를 `errors.ts`로 이동 |
| tools/index.ts 제거 | 통합 후 불필요 |

### 4.2 Out of Scope

| Item | Reason |
|------|--------|
| 새 Tool 추가 | 리펙토링 범위 밖 |
| UDS → 다른 통신 방식 변경 | 아키텍처 유지 |
| HTTP API 엔드포인트 변경 | 기능 유지 |
| 테스트 작성 | 리펙토링 후 별도 작업 |

## 5. Refactoring Details

### 5.1 MCP Tool 공통 유틸 — `src/mcp-server/lib/call-tool.ts`

반복되는 try-catch + mcpRequest + MCP 응답 포맷을 하나의 함수로 추출:

```typescript
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { mcpRequest } from './http-client'

export async function callTool(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    const { status, data } = await mcpRequest(method, path, body)
    if (status !== 200) {
      return { content: [{ type: 'text', text: `Error: ${data.error}` }], isError: true }
    }
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  } catch (error) {
    return { content: [{ type: 'text', text: (error as Error).message }], isError: true }
  }
}
```

**핵심 포인트**:
- `CallToolResult` 타입은 **SDK에서 직접 import** — 로컬 타입 정의 시 SDK 타입과 이름 충돌 방지
- `callTool()`의 반환 타입이 SDK의 `CallToolResult`와 일치하여 `server.tool()` 콜백에서 바로 사용 가능

### 5.2 Tool 선언적 정의 — `src/mcp-server/tool-definitions.ts`

9개 Tool을 config 객체로 선언하고, 루프로 등록한다.

> **파일명**: `tool-definitions.ts` (`tools.ts` 아님) — 기존 `tools/` 디렉토리와 이름 충돌 방지. `import './tools'`가 `tools/index.ts`와 `tools.ts` 사이에서 모호해지는 문제를 원천 차단.

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
    schema: { workspaceId: z.string().describe('Workspace ID') },
    handler: ({ workspaceId }) =>
      callTool('GET', `/api/workspaces/${enc(workspaceId)}/folders`)
  },
  // ... 나머지 7개 Tool (동일 패턴)
]

export function registerAllTools(server: McpServer): void {
  for (const tool of tools) {
    // handler를 ToolCallback으로 캐스팅 — ToolCallback<Args>는 (args, extra) 2개 파라미터이지만
    // extra를 사용하지 않으므로 (args) => ... 형태로 정의하고 as any로 전달
    server.tool(tool.name, tool.description, tool.schema, tool.handler as any)
  }
}
```

**핵심 포인트**:
- **`as any` 캐스팅 필요**: SDK의 `ToolCallback<Args>`는 `(args: ShapeOutput<Args>, extra: Extra) => CallToolResult`로 2개 파라미터를 받지만, `ToolDefinition.handler`는 `extra`를 사용하지 않으므로 1개 파라미터만 정의. `server.tool()` 호출 시 타입 불일치를 `as any`로 해소
- **파일명 `tool-definitions.ts`**: `tools/` 디렉토리와 충돌 회피. 삭제 순서에 의존하지 않음
- **효과**: 9개 파일 삭제, ~270줄 → ~120줄. 새 Tool 추가 시 config 객체 1개만 추가

### 5.3 Router 인스턴스화 — `src/main/mcp-api/router.ts`

전역 `routes` 배열 → `createRouter()` 팩토리:

```typescript
// Before
const routes: Route[] = []
export function addRoute(...) { routes.push(...) }
export async function router(req, res) { /* routes 참조 */ }

// After
export function createRouter() {
  const routes: Route[] = []

  function addRoute<TBody = null>(
    method: string,
    pathPattern: string,
    handler: (params: RouteParams, body: TBody, query: URLSearchParams) => any | Promise<any>
  ): void {
    // 기존 로직 동일
    routes.push({ method, pattern, paramNames, handler })
  }

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // 기존 router 로직 동일, 클로저로 routes 참조
  }

  return { addRoute, handle }
}

export type Router = ReturnType<typeof createRouter>
```

**Router 소유권**: `startMcpApiServer()` 내부에서 router를 생성하고 route를 등록한다. `index.ts`의 호출 방식(`registerAllRoutes()` + `startMcpApiServer()`)을 단일 `startMcpApiServer()` 호출로 통합하여 외부 API를 단순화한다.

```typescript
// src/main/mcp-api/server.ts (After)
import { createRouter } from './router'
import { registerAllRoutes } from './routes'

export function startMcpApiServer(): void {
  // router 생성 + route 등록을 server.ts 내부에서 수행
  const router = createRouter()
  registerAllRoutes(router)

  // 기존 소켓 처리 로직 동일
  // ...
  server = http.createServer(router.handle)
  server.listen(socketPath, () => { ... })
}

// src/main/index.ts (After) — registerAllRoutes() 호출 제거
// Before: registerAllRoutes() + startMcpApiServer()
// After:  startMcpApiServer()  ← 한 줄로 통합
```

### 5.4 Route 핸들러 Body 타입 강화

`addRoute`의 제네릭 `TBody`를 활용하여 각 route 핸들러의 body 타입을 명시한다 (5.3에서 이미 `addRoute<TBody>` 시그니처 정의됨).

```typescript
// GET route — body 없음 (기본값 TBody = null)
router.addRoute('GET', '/api/workspaces', (params, body, query) => { ... })

// PUT route — body 타입 명시
router.addRoute<{ content: string }>(
  'PUT', '/api/.../content', (params, body) => {
    // body.content — string 타입으로 추론
  }
)

// POST route
router.addRoute<{ title: string; folderId?: string; content?: string }>(
  'POST', '/api/.../notes', (params, body) => {
    // body.title, body.folderId, body.content — 타입 안전
  }
)
```

**참고**: `parseBody()`는 런타임에서 `any`를 반환하므로 컴파일 타임 전용 안전성. `requireBody()` assertion과 결합하여 런타임 체크도 유지.

### 5.5 에러 타입 통합

```typescript
// src/main/lib/errors.ts에 추가
export class PayloadTooLargeError extends Error {
  constructor() {
    super('Request body too large (max 10MB)')
    this.name = 'PayloadTooLargeError'
  }
}

// body-parser.ts에서는 import만
import { PayloadTooLargeError } from '../../lib/errors'
```

## 6. File Changes

### 6.1 New Files

| File | Description |
|------|-------------|
| `src/mcp-server/lib/call-tool.ts` | Tool 공통 유틸 (mcpRequest + 에러 처리 + SDK CallToolResult 반환) |
| `src/mcp-server/tool-definitions.ts` | 9개 Tool 선언적 정의 + `registerAllTools()` |

### 6.2 Modified Files

| File | Changes |
|------|---------|
| `src/main/mcp-api/router.ts` | 전역 `routes` 배열 + `addRoute()` + `router()` → `createRouter()` 팩토리 (addRoute에 `<TBody>` 제네릭 포함) |
| `src/main/mcp-api/server.ts` | 내부에서 `createRouter()` + `registerAllRoutes(router)` 수행. import 추가: `createRouter`, `registerAllRoutes` |
| `src/main/mcp-api/routes/index.ts` | `registerAllRoutes()` → `registerAllRoutes(router: Router)` 시그니처 변경 |
| `src/main/mcp-api/routes/workspace.ts` | `registerWorkspaceRoutes()` → `registerWorkspaceRoutes(router: Router)`, `addRoute` → `router.addRoute` |
| `src/main/mcp-api/routes/folder.ts` | `registerFolderRoutes()` → `registerFolderRoutes(router: Router)`, `addRoute` → `router.addRoute` |
| `src/main/mcp-api/routes/note.ts` | `registerNoteRoutes()` → `registerNoteRoutes(router: Router)`, `addRoute` → `router.addRoute` + body 타입 제네릭 적용 |
| `src/main/mcp-api/routes/search.ts` | `registerSearchRoutes()` → `registerSearchRoutes(router: Router)`, `addRoute` → `router.addRoute` |
| `src/main/mcp-api/lib/body-parser.ts` | `PayloadTooLargeError` class 제거 → `import { PayloadTooLargeError } from '../../lib/errors'` |
| `src/main/lib/errors.ts` | `PayloadTooLargeError` class 추가 |
| `src/main/index.ts` | `registerAllRoutes()` 호출 제거 (server.ts 내부로 이동). `import { registerAllRoutes }` 제거 |
| `src/mcp-server/index.ts` | import 경로 변경: `'./tools'` → `'./tool-definitions'` |

### 6.3 Deleted Files

| File | Reason |
|------|--------|
| `src/mcp-server/tools/list-workspaces.ts` | tool-definitions.ts로 통합 |
| `src/mcp-server/tools/list-folders.ts` | tool-definitions.ts로 통합 |
| `src/mcp-server/tools/list-notes.ts` | tool-definitions.ts로 통합 |
| `src/mcp-server/tools/read-note.ts` | tool-definitions.ts로 통합 |
| `src/mcp-server/tools/write-note.ts` | tool-definitions.ts로 통합 |
| `src/mcp-server/tools/create-note.ts` | tool-definitions.ts로 통합 |
| `src/mcp-server/tools/rename-note.ts` | tool-definitions.ts로 통합 |
| `src/mcp-server/tools/move-note.ts` | tool-definitions.ts로 통합 |
| `src/mcp-server/tools/search-notes.ts` | tool-definitions.ts로 통합 |
| `src/mcp-server/tools/index.ts` | tool-definitions.ts로 통합 |

## 7. Implementation Order

두 개의 독립 작업 블록으로 나뉜다. 각 블록 완료 후 빌드 확인.

### Block A: MCP Server (src/mcp-server/) — Tool 통합

| Step | Description | Files |
|------|-------------|-------|
| A-1 | `callTool()` 공통 유틸 생성 (SDK `CallToolResult` import) | `src/mcp-server/lib/call-tool.ts` |
| A-2 | 9개 Tool → `tool-definitions.ts` 단일 파일로 통합 (`as any` 캐스팅 포함) | `src/mcp-server/tool-definitions.ts` |
| A-3 | `src/mcp-server/index.ts` import 경로 변경: `'./tools'` → `'./tool-definitions'` | `src/mcp-server/index.ts` |
| A-4 | 기존 `tools/` 디렉토리 삭제 (10개 파일) | `src/mcp-server/tools/` |
| A-5 | `npm run build:mcp` 확인 | - |

### Block B: MCP API (src/main/mcp-api/) — Router + 에러 정리

| Step | Description | Files |
|------|-------------|-------|
| B-1 | `PayloadTooLargeError`를 `errors.ts`로 이동, `body-parser.ts` import 변경 | `errors.ts`, `body-parser.ts` |
| B-2 | `router.ts` → `createRouter()` 팩토리 전환 (`<TBody>` 제네릭 포함) | `router.ts` |
| B-3 | route 파일 4개: 함수 시그니처에 `(router: Router)` 파라미터 추가 + `router.addRoute` 방식으로 변경 | `workspace.ts`, `folder.ts`, `search.ts`, `note.ts` |
| B-4 | `routes/index.ts`: `registerAllRoutes(router: Router)` 시그니처 변경 + 하위 함수에 router 전달 | `routes/index.ts` |
| B-5 | `server.ts`: 내부에서 `createRouter()` + `registerAllRoutes(router)` 수행 | `server.ts` |
| B-6 | `index.ts`: `registerAllRoutes()` 호출 및 import 제거 | `index.ts` |
| B-7 | Route 핸들러 body 타입 제네릭 적용 (PUT/POST/PATCH 핸들러) | `routes/note.ts` |
| B-8 | `npm run typecheck` 확인 | - |

## 8. Success Criteria

| # | Criteria |
|---|---------|
| SC-1 | `npm run build:mcp` 성공 |
| SC-2 | `npm run typecheck` 성공 |
| SC-3 | MCP 서버 9개 Tool 정상 동작 (기존과 동일) |
| SC-4 | `src/mcp-server/tools/` 디렉토리 삭제됨 |
| SC-5 | MCP Tool 코드량 ~270줄 → ~120줄 이하 |
| SC-6 | `router.ts`에 모듈 레벨 전역 상태 없음 |
| SC-7 | `PayloadTooLargeError`가 `errors.ts`에 통합됨 |

## 9. Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| R-1 | Tool 통합 시 개별 Tool의 고유 로직 누락 | 높음 | write_note의 이미지 경고 description 등 9개 Tool 개별 확인 |
| R-2 | Router 인스턴스화 시 기존 route 등록 순서 변경 | 중간 | search → note 순서 `routes/index.ts`에서 명시적 유지 |
| R-3 | 제네릭 body 타입이 과도한 타입 복잡도 유발 | 낮음 | 복잡한 경우 as 캐스팅 허용 |
| R-4 | `server.tool()` → `as any` 캐스팅이 런타임 오류를 숨길 수 있음 | 낮음 | SDK가 zod schema로 args를 런타임 검증하므로 실질적 위험 없음 |
| R-5 | SDK `CallToolResult` import 경로가 버전에 따라 다를 수 있음 | 낮음 | `@modelcontextprotocol/sdk/types.js` 경로 확인 후 사용 |

## 10. Constraints

| # | Constraint |
|---|-----------|
| C-1 | 기존 9개 MCP Tool의 name, description, schema, HTTP 매핑이 **정확히** 동일해야 함 |
| C-2 | `startMcpApiServer()` / `stopMcpApiServer()`의 외부 API(시그니처)는 변경하지 않음 |
| C-3 | HTTP API 엔드포인트 경로/메서드는 변경하지 않음 |
| C-4 | `npm run build:mcp` + `npm run typecheck` 모두 통과해야 함 |

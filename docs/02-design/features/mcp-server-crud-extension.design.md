# MCP Server CRUD Extension Design Document

> **Summary**: 기존 MCP 서버(note 9개 도구)에 Table(CSV) 7개, Canvas 9개, Folder 4개 도구를 추가한다. 기존 아키텍처(MCP Server → UDS HTTP → Electron main service layer)를 그대로 따르며, Canvas에는 새로운 push 채널(`canvas:changed`)을 추가한다.
>
> **Date**: 2026-03-07
> **Status**: Draft
> **Planning Doc**: [mcp-server-crud-extension.plan.md](../../01-plan/features/mcp-server-crud-extension.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- 기존 MCP 서버에 20개 MCP Tool 추가 (9 → 29개)
- HTTP API 라우트 20개 추가 (`csv.ts`, `canvas.ts` 신규 + `folder.ts` 확장)
- Canvas push 채널 신규 구현 (`canvas:changed` preload + renderer watcher)
- MCP Tool 정의는 기존 `tool-definitions.ts`의 배열 패턴 유지
- 기존 note 관련 9개 도구 정상 동작 유지

### 1.2 Design Principles

- **기존 패턴 100% 준수** — 기존 note 라우트/tool 패턴을 그대로 복제
- **서비스 레이어 재사용** — 새 비즈니스 로직 없음, 기존 service 메서드만 호출
- **DB 직접 조작 금지** — MCP 서버는 HTTP API를 통해서만 접근
- **broadcastChanged 직접 호출** — watcher 의존 없이 HTTP API 핸들러에서 직접 push
- **최소 변경** — 신규 파일 3개 + 수정 파일 7개

---

## 2. Architecture

### 2.1 Data Flow (기존과 동일)

```
[MCP Tool 호출]
  Claude Desktop/Code → stdio → MCP Server (src/mcp-server/)
    → callTool(method, url, body?) → mcpRequest()
    → http.request({ socketPath: '~/.rally/mcp.sock', path: '/api/...' })
    → Electron Main (src/main/mcp-api/)
    → router.ts: URL 패턴 매칭 + JSON body 파싱
    → routes/*.ts: 서비스 레이어 호출

[읽기 요청] (GET)
  handler → service/repository 호출 → JSON 응답 반환

[쓰기 요청] (POST/PUT/PATCH/DELETE)
  handler → service 호출 → broadcastChanged() → JSON 응답 반환

[Renderer 반영]
  BrowserWindow.send(channel, wsId, paths)
    → Note/CSV: useFileWatcher → queryClient.invalidateQueries()
    → Folder: useFolderWatcher → queryClient.invalidateQueries()
    → Canvas: useCanvasWatcher (신규) → queryClient.invalidateQueries()
```

### 2.2 Layer Map (변경사항만)

```
+-- Electron Main Process (src/main/) -------------------------+
|  mcp-api/routes/csv.ts         7개 CSV 엔드포인트 (신규)       |
|  mcp-api/routes/canvas.ts      9개 Canvas 엔드포인트 (신규)    |
|  mcp-api/routes/folder.ts      4개 Folder 엔드포인트 (기존 확장)|
|  mcp-api/routes/index.ts       새 라우트 등록 추가              |
+-- Standalone Node.js Process (src/mcp-server/) ---------------+
|  tool-definitions.ts           20개 Tool 추가 (기존 배열 확장)  |
+-- Electron Preload (src/preload/) ----------------------------+
|  index.ts                      canvas.onChanged 추가           |
|  index.d.ts                    CanvasAPI 타입 확장              |
+-- React Renderer (src/renderer/) -----------------------------+
|  entities/canvas/model/use-canvas-watcher.ts   (신규)          |
|  entities/canvas/index.ts      useCanvasWatcher export 추가    |
|  app/layout/MainLayout.tsx     useCanvasWatcher() 호출 추가    |
+---------------------------------------------------------------+
```

---

## 3. Data Model

DB 스키마 변경 없음. 기존 테이블만 사용한다.

### 3.1 추가로 사용하는 기존 테이블

| Table | Used By Tools | Key Columns |
|-------|--------------|-------------|
| `csv_files` | list_tables, read_table, write_table, create_table, rename_table, delete_table, move_table | `id`, `workspaceId`, `folderId`, `relativePath`, `title`, `preview`, `description` |
| `canvases` | list_canvases, read_canvas, create_canvas, update_canvas, delete_canvas | `id`, `workspaceId`, `title`, `description`, `createdAt`, `updatedAt` |
| `canvas_nodes` | read_canvas, add_canvas_node, remove_canvas_node | `id`, `canvasId`, `type`, `refId`, `x`, `y`, `width`, `height`, `color`, `content`, `zIndex` |
| `canvas_edges` | read_canvas, add_canvas_edge, remove_canvas_edge | `id`, `canvasId`, `fromNode`, `toNode`, `fromSide`, `toSide`, `label`, `style`, `arrow` |
| `folders` | create_folder, rename_folder, delete_folder, move_folder | `id`, `workspaceId`, `relativePath`, `name`, `order` |

### 3.2 HTTP API 응답 타입 (New)

```typescript
// ─── Table (CSV) ────────────────────────────────────

// GET /api/workspaces/:wsId/tables
interface ListTablesResponse {
  tables: {
    id: string
    title: string
    relativePath: string
    description: string
    preview: string
    folderId: string | null
    folderPath: string | null
    updatedAt: string  // ISO string
  }[]
}

// GET /api/workspaces/:wsId/tables/:tableId/content
interface ReadTableResponse {
  title: string
  relativePath: string
  content: string
  encoding: string
}

// PUT /api/workspaces/:wsId/tables/:tableId/content
interface WriteTableResponse {
  success: true
  title: string
  relativePath: string
}

// POST /api/workspaces/:wsId/tables
interface CreateTableResponse {
  id: string
  title: string
  relativePath: string
}

// PATCH /api/workspaces/:wsId/tables/:tableId/rename
interface RenameTableResponse {
  id: string
  title: string
  relativePath: string
}

// DELETE /api/workspaces/:wsId/tables/:tableId
interface DeleteTableResponse {
  success: true
}

// PATCH /api/workspaces/:wsId/tables/:tableId/move
interface MoveTableResponse {
  id: string
  title: string
  relativePath: string
  folderId: string | null
}

// ─── Canvas ─────────────────────────────────────────

// GET /api/workspaces/:wsId/canvases
interface ListCanvasesResponse {
  canvases: {
    id: string
    title: string
    description: string
    createdAt: string
    updatedAt: string
  }[]
}

// GET /api/workspaces/:wsId/canvases/:canvasId
interface ReadCanvasResponse {
  canvas: {
    id: string
    title: string
    description: string
    createdAt: string
    updatedAt: string
  }
  nodes: {
    id: string
    canvasId: string
    type: CanvasNodeType
    refId: string | null
    x: number
    y: number
    width: number
    height: number
    color: string | null
    content: string | null
    zIndex: number
    createdAt: string
    updatedAt: string
    refTitle?: string
    refPreview?: string
    refMeta?: Record<string, unknown>
  }[]
  edges: {
    id: string
    canvasId: string
    fromNode: string
    toNode: string
    fromSide: string
    toSide: string
    label: string | null
    color: string | null
    style: string
    arrow: string
    createdAt: string
  }[]
}

// POST /api/workspaces/:wsId/canvases
interface CreateCanvasResponse {
  id: string
  title: string
  description: string
}

// PATCH /api/workspaces/:wsId/canvases/:canvasId
interface UpdateCanvasResponse {
  id: string
  title: string
  description: string
}

// DELETE /api/workspaces/:wsId/canvases/:canvasId
interface DeleteCanvasResponse {
  success: true
}

// POST /api/workspaces/:wsId/canvases/:canvasId/nodes
interface AddCanvasNodeResponse {
  id: string
  canvasId: string
  type: CanvasNodeType
  x: number
  y: number
  width: number
  height: number
  content: string | null
  refId: string | null
}

// DELETE /api/workspaces/:wsId/canvases/:canvasId/nodes/:nodeId
interface RemoveCanvasNodeResponse {
  success: true
}

// POST /api/workspaces/:wsId/canvases/:canvasId/edges
interface AddCanvasEdgeResponse {
  id: string
  canvasId: string
  fromNode: string
  toNode: string
  fromSide: string
  toSide: string
  label: string | null
  style: string
  arrow: string
}

// DELETE /api/workspaces/:wsId/canvases/:canvasId/edges/:edgeId
interface RemoveCanvasEdgeResponse {
  success: true
}

// ─── Folder ─────────────────────────────────────────

// POST /api/workspaces/:wsId/folders
interface CreateFolderResponse {
  id: string
  name: string
  relativePath: string
}

// PATCH /api/workspaces/:wsId/folders/:folderId/rename
interface RenameFolderResponse {
  id: string
  name: string
  relativePath: string
}

// DELETE /api/workspaces/:wsId/folders/:folderId
interface DeleteFolderResponse {
  success: true
}

// PATCH /api/workspaces/:wsId/folders/:folderId/move
interface MoveFolderResponse {
  id: string
  name: string
  relativePath: string
}
```

---

## 4. HTTP API Endpoints

### 4.1 Routing Table (New — 20 endpoints)

| Method | Path | Handler File | Service Call | Broadcast |
|--------|------|-------------|-------------|-----------|
| GET | `/api/workspaces/:wsId/tables` | `csv.ts` | `csvFileService.readByWorkspaceFromDb()` + folder Map | — |
| GET | `/api/workspaces/:wsId/tables/:tableId/content` | `csv.ts` | `csvFileRepository.findById()` + `csvFileService.readContent()` | — |
| PUT | `/api/workspaces/:wsId/tables/:tableId/content` | `csv.ts` | `csvFileRepository.findById()` + `csvFileService.writeContent()` | `csv:changed` |
| POST | `/api/workspaces/:wsId/tables` | `csv.ts` | `csvFileService.create()` + optional `csvFileService.writeContent()` | `csv:changed` |
| PATCH | `/api/workspaces/:wsId/tables/:tableId/rename` | `csv.ts` | `csvFileRepository.findById()` + `csvFileService.rename()` | `csv:changed` |
| DELETE | `/api/workspaces/:wsId/tables/:tableId` | `csv.ts` | `csvFileRepository.findById()` + `csvFileService.remove()` | `csv:changed` |
| PATCH | `/api/workspaces/:wsId/tables/:tableId/move` | `csv.ts` | `csvFileRepository.findById()` + `csvFileService.move()` | `csv:changed` |
| GET | `/api/workspaces/:wsId/canvases` | `canvas.ts` | `canvasService.findByWorkspace()` | — |
| GET | `/api/workspaces/:wsId/canvases/:canvasId` | `canvas.ts` | `canvasService.findById()` + `canvasNodeService.findByCanvas()` + `canvasEdgeService.findByCanvas()` | — |
| POST | `/api/workspaces/:wsId/canvases` | `canvas.ts` | `canvasService.create()` | `canvas:changed` |
| PATCH | `/api/workspaces/:wsId/canvases/:canvasId` | `canvas.ts` | `canvasService.update()` | `canvas:changed` |
| DELETE | `/api/workspaces/:wsId/canvases/:canvasId` | `canvas.ts` | `canvasService.remove()` | `canvas:changed` |
| POST | `/api/workspaces/:wsId/canvases/:canvasId/nodes` | `canvas.ts` | `canvasNodeService.create()` | `canvas:changed` |
| DELETE | `/api/workspaces/:wsId/canvases/:canvasId/nodes/:nodeId` | `canvas.ts` | `canvasNodeService.remove()` | `canvas:changed` |
| POST | `/api/workspaces/:wsId/canvases/:canvasId/edges` | `canvas.ts` | `canvasEdgeService.create()` | `canvas:changed` |
| DELETE | `/api/workspaces/:wsId/canvases/:canvasId/edges/:edgeId` | `canvas.ts` | `canvasEdgeService.remove()` | `canvas:changed` |
| POST | `/api/workspaces/:wsId/folders` | `folder.ts` | `folderService.create()` | `folder:changed` |
| PATCH | `/api/workspaces/:wsId/folders/:folderId/rename` | `folder.ts` | `folderService.rename()` | `folder:changed` + `note:changed` + `csv:changed` |
| DELETE | `/api/workspaces/:wsId/folders/:folderId` | `folder.ts` | `folderRepository.findById()` + `folderService.remove()` | `folder:changed` + `note:changed` + `csv:changed` |
| PATCH | `/api/workspaces/:wsId/folders/:folderId/move` | `folder.ts` | `folderService.move()` | `folder:changed` + `note:changed` + `csv:changed` |

### 4.2 URL 매칭 순서

라우트 등록 순서가 중요한 케이스:
- `/api/workspaces/:wsId/canvases/:canvasId/nodes` vs `/api/workspaces/:wsId/canvases/:canvasId` — 긴 패턴이 먼저 매칭되므로 문제 없음 (regex `^...$`가 정확 매칭)
- Canvas/CSV 라우트는 note/search 라우트와 URL이 겹치지 않으므로 등록 순서 자유

---

## 5. Implementation Details

### 5.1 Route Handler — `src/main/mcp-api/routes/csv.ts` (신규)

기존 `note.ts` 패턴을 그대로 따른다.

```typescript
import type { Router } from '../router'
import { csvFileService } from '../../services/csv-file'
import { csvFileRepository } from '../../repositories/csv-file'
import { folderRepository } from '../../repositories/folder'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { broadcastChanged } from '../lib/broadcast'

function requireBody(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required')
  }
}

export function registerCsvRoutes(router: Router): void {
  // GET /api/workspaces/:wsId/tables
  router.addRoute('GET', '/api/workspaces/:wsId/tables', (params) => {
    const tables = csvFileService.readByWorkspaceFromDb(params.wsId)
    const folders = folderRepository.findByWorkspaceId(params.wsId)
    const folderMap = new Map(folders.map((f) => [f.id, f.relativePath]))

    return {
      tables: tables.map((t) => ({
        id: t.id,
        title: t.title,
        relativePath: t.relativePath,
        description: t.description,
        preview: t.preview,
        folderId: t.folderId,
        folderPath: t.folderId ? (folderMap.get(t.folderId) ?? null) : null,
        updatedAt: t.updatedAt.toISOString()
      }))
    }
  })

  // GET /api/workspaces/:wsId/tables/:tableId/content
  router.addRoute('GET', '/api/workspaces/:wsId/tables/:tableId/content', (params) => {
    const csv = csvFileRepository.findById(params.tableId)
    if (!csv) throw new NotFoundError(`Table not found: ${params.tableId}`)

    const { content, encoding } = csvFileService.readContent(params.wsId, params.tableId)
    return {
      title: csv.title,
      relativePath: csv.relativePath,
      content,
      encoding
    }
  })

  // PUT /api/workspaces/:wsId/tables/:tableId/content
  router.addRoute<{ content: string }>(
    'PUT',
    '/api/workspaces/:wsId/tables/:tableId/content',
    (params, body) => {
      requireBody(body)
      const csv = csvFileRepository.findById(params.tableId)
      if (!csv) throw new NotFoundError(`Table not found: ${params.tableId}`)

      csvFileService.writeContent(params.wsId, params.tableId, body.content)

      broadcastChanged('csv:changed', params.wsId, [csv.relativePath])

      return {
        success: true,
        title: csv.title,
        relativePath: csv.relativePath
      }
    }
  )

  // POST /api/workspaces/:wsId/tables
  router.addRoute<{ title: string; folderId?: string; content?: string }>(
    'POST',
    '/api/workspaces/:wsId/tables',
    (params, body) => {
      requireBody(body)
      const folderId = body.folderId ?? null
      // Tool의 title → service의 name 파라미터
      const result = csvFileService.create(params.wsId, folderId, body.title)

      try {
        if (body.content) {
          csvFileService.writeContent(params.wsId, result.id, body.content)
        }
      } finally {
        broadcastChanged('csv:changed', params.wsId, [result.relativePath])
      }

      return {
        id: result.id,
        title: result.title,
        relativePath: result.relativePath
      }
    }
  )

  // PATCH /api/workspaces/:wsId/tables/:tableId/rename
  router.addRoute<{ newName: string }>(
    'PATCH',
    '/api/workspaces/:wsId/tables/:tableId/rename',
    (params, body) => {
      requireBody(body)
      const oldCsv = csvFileRepository.findById(params.tableId)
      if (!oldCsv) throw new NotFoundError(`Table not found: ${params.tableId}`)

      const result = csvFileService.rename(params.wsId, params.tableId, body.newName)

      broadcastChanged('csv:changed', params.wsId, [oldCsv.relativePath, result.relativePath])

      return {
        id: result.id,
        title: result.title,
        relativePath: result.relativePath
      }
    }
  )

  // DELETE /api/workspaces/:wsId/tables/:tableId
  router.addRoute('DELETE', '/api/workspaces/:wsId/tables/:tableId', (params) => {
    const csv = csvFileRepository.findById(params.tableId)
    if (!csv) throw new NotFoundError(`Table not found: ${params.tableId}`)

    csvFileService.remove(params.wsId, params.tableId)

    broadcastChanged('csv:changed', params.wsId, [csv.relativePath])

    return { success: true }
  })

  // PATCH /api/workspaces/:wsId/tables/:tableId/move
  router.addRoute<{ targetFolderId?: string }>(
    'PATCH',
    '/api/workspaces/:wsId/tables/:tableId/move',
    (params, body) => {
      requireBody(body)
      const oldCsv = csvFileRepository.findById(params.tableId)
      if (!oldCsv) throw new NotFoundError(`Table not found: ${params.tableId}`)

      const targetFolderId = body.targetFolderId ?? null
      const result = csvFileService.move(params.wsId, params.tableId, targetFolderId, 0)

      broadcastChanged('csv:changed', params.wsId, [oldCsv.relativePath, result.relativePath])

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

### 5.2 Route Handler — `src/main/mcp-api/routes/canvas.ts` (신규)

```typescript
import type { Router } from '../router'
import { canvasService } from '../../services/canvas'
import { canvasNodeService } from '../../services/canvas-node'
import { canvasEdgeService } from '../../services/canvas-edge'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { broadcastChanged } from '../lib/broadcast'

function requireBody(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required')
  }
}

export function registerCanvasRoutes(router: Router): void {
  // GET /api/workspaces/:wsId/canvases
  router.addRoute('GET', '/api/workspaces/:wsId/canvases', (params) => {
    const canvases = canvasService.findByWorkspace(params.wsId)
    return {
      canvases: canvases.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString()
      }))
    }
  })

  // GET /api/workspaces/:wsId/canvases/:canvasId
  // 주의: /nodes, /edges 패턴보다 뒤에 등록해야 하지만, regex 정확 매칭($)이므로 충돌 없음
  router.addRoute('GET', '/api/workspaces/:wsId/canvases/:canvasId', (params) => {
    const canvas = canvasService.findById(params.canvasId)
    const nodes = canvasNodeService.findByCanvas(params.canvasId)
    const edges = canvasEdgeService.findByCanvas(params.canvasId)

    return {
      canvas: {
        id: canvas.id,
        title: canvas.title,
        description: canvas.description,
        createdAt: canvas.createdAt.toISOString(),
        updatedAt: canvas.updatedAt.toISOString()
      },
      nodes,
      edges
    }
  })

  // POST /api/workspaces/:wsId/canvases
  router.addRoute<{ title: string; description?: string }>(
    'POST',
    '/api/workspaces/:wsId/canvases',
    (params, body) => {
      requireBody(body)
      const result = canvasService.create(params.wsId, {
        title: body.title,
        description: body.description
      })

      broadcastChanged('canvas:changed', params.wsId, [])

      return {
        id: result.id,
        title: result.title,
        description: result.description
      }
    }
  )

  // PATCH /api/workspaces/:wsId/canvases/:canvasId
  router.addRoute<{ title?: string; description?: string }>(
    'PATCH',
    '/api/workspaces/:wsId/canvases/:canvasId',
    (params, body) => {
      requireBody(body)
      const result = canvasService.update(params.canvasId, {
        title: body.title,
        description: body.description
      })

      broadcastChanged('canvas:changed', params.wsId, [])

      return {
        id: result.id,
        title: result.title,
        description: result.description
      }
    }
  )

  // DELETE /api/workspaces/:wsId/canvases/:canvasId
  router.addRoute('DELETE', '/api/workspaces/:wsId/canvases/:canvasId', (params) => {
    canvasService.remove(params.canvasId)

    broadcastChanged('canvas:changed', params.wsId, [])

    return { success: true }
  })

  // POST /api/workspaces/:wsId/canvases/:canvasId/nodes
  router.addRoute<{
    type: string
    x: number
    y: number
    width?: number
    height?: number
    content?: string
    refId?: string
    color?: string
  }>('POST', '/api/workspaces/:wsId/canvases/:canvasId/nodes', (params, body) => {
    requireBody(body)
    const result = canvasNodeService.create(params.canvasId, {
      type: body.type as any,
      x: body.x,
      y: body.y,
      width: body.width,
      height: body.height,
      content: body.content,
      refId: body.refId,
      color: body.color
    })

    broadcastChanged('canvas:changed', params.wsId, [])

    return {
      id: result.id,
      canvasId: result.canvasId,
      type: result.type,
      x: result.x,
      y: result.y,
      width: result.width,
      height: result.height,
      content: result.content,
      refId: result.refId
    }
  })

  // DELETE /api/workspaces/:wsId/canvases/:canvasId/nodes/:nodeId
  router.addRoute(
    'DELETE',
    '/api/workspaces/:wsId/canvases/:canvasId/nodes/:nodeId',
    (params) => {
      canvasNodeService.remove(params.nodeId)

      broadcastChanged('canvas:changed', params.wsId, [])

      return { success: true }
    }
  )

  // POST /api/workspaces/:wsId/canvases/:canvasId/edges
  router.addRoute<{
    fromNode: string
    toNode: string
    fromSide?: string
    toSide?: string
    label?: string
    color?: string
    style?: string
    arrow?: string
  }>('POST', '/api/workspaces/:wsId/canvases/:canvasId/edges', (params, body) => {
    requireBody(body)
    const result = canvasEdgeService.create(params.canvasId, {
      fromNode: body.fromNode,
      toNode: body.toNode,
      fromSide: body.fromSide as any,
      toSide: body.toSide as any,
      label: body.label,
      color: body.color,
      style: body.style as any,
      arrow: body.arrow as any
    })

    broadcastChanged('canvas:changed', params.wsId, [])

    return {
      id: result.id,
      canvasId: result.canvasId,
      fromNode: result.fromNode,
      toNode: result.toNode,
      fromSide: result.fromSide,
      toSide: result.toSide,
      label: result.label,
      style: result.style,
      arrow: result.arrow
    }
  })

  // DELETE /api/workspaces/:wsId/canvases/:canvasId/edges/:edgeId
  router.addRoute(
    'DELETE',
    '/api/workspaces/:wsId/canvases/:canvasId/edges/:edgeId',
    (params) => {
      canvasEdgeService.remove(params.edgeId)

      broadcastChanged('canvas:changed', params.wsId, [])

      return { success: true }
    }
  )
}
```

### 5.3 Route Handler — `src/main/mcp-api/routes/folder.ts` (확장)

기존 GET 라우트에 POST/PATCH/DELETE를 추가한다.

```typescript
import type { Router } from '../router'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { folderService } from '../../services/folder'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { broadcastChanged } from '../lib/broadcast'

function requireBody(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required')
  }
}

export function registerFolderRoutes(router: Router): void {
  // 기존 GET /api/workspaces/:wsId/folders (변경 없음)
  router.addRoute('GET', '/api/workspaces/:wsId/folders', (params) => {
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

  // POST /api/workspaces/:wsId/folders (신규)
  router.addRoute<{ parentFolderId?: string; name: string }>(
    'POST',
    '/api/workspaces/:wsId/folders',
    (params, body) => {
      requireBody(body)
      const parentFolderId = body.parentFolderId ?? null
      const result = folderService.create(params.wsId, parentFolderId, body.name)

      broadcastChanged('folder:changed', params.wsId, [result.relativePath])

      return {
        id: result.id,
        name: result.name,
        relativePath: result.relativePath
      }
    }
  )

  // PATCH /api/workspaces/:wsId/folders/:folderId/rename (신규)
  router.addRoute<{ newName: string }>(
    'PATCH',
    '/api/workspaces/:wsId/folders/:folderId/rename',
    (params, body) => {
      requireBody(body)
      const result = folderService.rename(params.wsId, params.folderId, body.newName)

      broadcastChanged('folder:changed', params.wsId, [result.relativePath])
      // 하위 note/csv 경로도 변경됨 — 목록 캐시 invalidation
      broadcastChanged('note:changed', params.wsId, [])
      broadcastChanged('csv:changed', params.wsId, [])

      return {
        id: result.id,
        name: result.name,
        relativePath: result.relativePath
      }
    }
  )

  // DELETE /api/workspaces/:wsId/folders/:folderId (신규)
  router.addRoute('DELETE', '/api/workspaces/:wsId/folders/:folderId', (params) => {
    const folder = folderRepository.findById(params.folderId)
    if (!folder) throw new NotFoundError(`Folder not found: ${params.folderId}`)

    folderService.remove(params.wsId, params.folderId)

    broadcastChanged('folder:changed', params.wsId, [folder.relativePath])
    // 하위 note/csv DB 레코드는 watcher/reconciliation이 정리
    broadcastChanged('note:changed', params.wsId, [])
    broadcastChanged('csv:changed', params.wsId, [])

    return { success: true }
  })

  // PATCH /api/workspaces/:wsId/folders/:folderId/move (신규)
  router.addRoute<{ parentFolderId?: string }>(
    'PATCH',
    '/api/workspaces/:wsId/folders/:folderId/move',
    (params, body) => {
      requireBody(body)
      const parentFolderId = body.parentFolderId ?? null
      const result = folderService.move(params.wsId, params.folderId, parentFolderId, 0)

      broadcastChanged('folder:changed', params.wsId, [result.relativePath])
      broadcastChanged('note:changed', params.wsId, [])
      broadcastChanged('csv:changed', params.wsId, [])

      return {
        id: result.id,
        name: result.name,
        relativePath: result.relativePath
      }
    }
  )
}
```

### 5.4 Route Registration — `src/main/mcp-api/routes/index.ts` (수정)

```typescript
import type { Router } from '../router'
import { registerWorkspaceRoutes } from './workspace'
import { registerFolderRoutes } from './folder'
import { registerNoteRoutes } from './note'
import { registerSearchRoutes } from './search'
import { registerCsvRoutes } from './csv'       // 추가
import { registerCanvasRoutes } from './canvas'  // 추가

export function registerAllRoutes(router: Router): void {
  registerWorkspaceRoutes(router)
  registerFolderRoutes(router)
  // search를 note보다 먼저 등록 (URL 매칭 순서)
  registerSearchRoutes(router)
  registerNoteRoutes(router)
  registerCsvRoutes(router)      // 추가
  registerCanvasRoutes(router)   // 추가
}
```

### 5.5 MCP Tool Definitions — `src/mcp-server/tool-definitions.ts` (확장)

기존 `tools` 배열에 20개 도구를 추가한다. 기존 패턴(ToolDefinition + callTool)을 그대로 사용.

```typescript
// 기존 tools 배열에 추가할 항목들 (9개 기존 + 20개 신규 = 29개)

// ─── Table (CSV) Tools ──────────────────────────────

{
  name: 'list_tables',
  description: 'List all CSV tables in a workspace with title, path, preview, and folder info',
  schema: {
    workspaceId: z.string().describe('Workspace ID')
  },
  handler: ({ workspaceId }) =>
    callTool('GET', `/api/workspaces/${e(workspaceId)}/tables`)
},
{
  name: 'read_table',
  description: 'Read the full CSV content of a table with encoding info',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    tableId: z.string().describe('Table ID')
  },
  handler: ({ workspaceId, tableId }) =>
    callTool('GET', `/api/workspaces/${e(workspaceId)}/tables/${e(tableId)}/content`)
},
{
  name: 'write_table',
  description:
    'Update the content of an existing CSV table. WARNING: This replaces the entire file content. Read the table first and modify the content to avoid data loss.',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    tableId: z.string().describe('Table ID'),
    content: z.string().describe('New CSV content (full file replacement)')
  },
  handler: ({ workspaceId, tableId, content }) =>
    callTool(
      'PUT',
      `/api/workspaces/${e(workspaceId)}/tables/${e(tableId)}/content`,
      { content }
    )
},
{
  name: 'create_table',
  description: 'Create a new CSV table in a workspace. Optionally set initial content.',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    folderId: z.string().optional().describe('Folder ID (omit for root level)'),
    title: z.string().describe('Table name (without .csv extension)'),
    content: z.string().optional().describe('Initial CSV content')
  },
  handler: ({ workspaceId, folderId, title, content }) =>
    callTool('POST', `/api/workspaces/${e(workspaceId)}/tables`, { title, folderId, content })
},
{
  name: 'rename_table',
  description: 'Rename a CSV table (changes file name on disk)',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    tableId: z.string().describe('Table ID'),
    newName: z.string().describe('New table name (without .csv extension)')
  },
  handler: ({ workspaceId, tableId, newName }) =>
    callTool(
      'PATCH',
      `/api/workspaces/${e(workspaceId)}/tables/${e(tableId)}/rename`,
      { newName }
    )
},
{
  name: 'delete_table',
  description: 'Permanently delete a CSV table file. This action cannot be undone.',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    tableId: z.string().describe('Table ID')
  },
  handler: ({ workspaceId, tableId }) =>
    callTool('DELETE', `/api/workspaces/${e(workspaceId)}/tables/${e(tableId)}`)
},
{
  name: 'move_table',
  description:
    'Move a CSV table to a different folder. Omit targetFolderId for root. Table is placed at the top of the target folder.',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    tableId: z.string().describe('Table ID'),
    targetFolderId: z.string().optional().describe('Target folder ID (omit for root level)')
  },
  handler: ({ workspaceId, tableId, targetFolderId }) =>
    callTool(
      'PATCH',
      `/api/workspaces/${e(workspaceId)}/tables/${e(tableId)}/move`,
      { targetFolderId }
    )
},

// ─── Canvas Tools ───────────────────────────────────

{
  name: 'list_canvases',
  description: 'List all canvases in a workspace with title and description',
  schema: {
    workspaceId: z.string().describe('Workspace ID')
  },
  handler: ({ workspaceId }) =>
    callTool('GET', `/api/workspaces/${e(workspaceId)}/canvases`)
},
{
  name: 'read_canvas',
  description:
    'Read a canvas with all its nodes and edges. Nodes include reference data (refTitle, refPreview) for linked items.',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    canvasId: z.string().describe('Canvas ID')
  },
  handler: ({ workspaceId, canvasId }) =>
    callTool('GET', `/api/workspaces/${e(workspaceId)}/canvases/${e(canvasId)}`)
},
{
  name: 'create_canvas',
  description: 'Create a new canvas in a workspace',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    title: z.string().describe('Canvas title'),
    description: z.string().optional().describe('Canvas description')
  },
  handler: ({ workspaceId, title, description }) =>
    callTool('POST', `/api/workspaces/${e(workspaceId)}/canvases`, { title, description })
},
{
  name: 'update_canvas',
  description: 'Update canvas title and/or description',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    canvasId: z.string().describe('Canvas ID'),
    title: z.string().optional().describe('New title'),
    description: z.string().optional().describe('New description')
  },
  handler: ({ workspaceId, canvasId, title, description }) =>
    callTool(
      'PATCH',
      `/api/workspaces/${e(workspaceId)}/canvases/${e(canvasId)}`,
      { title, description }
    )
},
{
  name: 'delete_canvas',
  description:
    'WARNING: Permanently delete a canvas and ALL its nodes and edges. This action cannot be undone.',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    canvasId: z.string().describe('Canvas ID')
  },
  handler: ({ workspaceId, canvasId }) =>
    callTool('DELETE', `/api/workspaces/${e(workspaceId)}/canvases/${e(canvasId)}`)
},
{
  name: 'add_canvas_node',
  description:
    'Add a node to a canvas. Types: text, todo, note, schedule, csv, pdf, image. For reference types (todo, note, etc.), provide refId of the existing item.',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    canvasId: z.string().describe('Canvas ID'),
    type: z
      .enum(['text', 'todo', 'note', 'schedule', 'csv', 'pdf', 'image'])
      .describe('Node type'),
    x: z.number().describe('X position'),
    y: z.number().describe('Y position'),
    width: z.number().optional().describe('Width (default: 260)'),
    height: z.number().optional().describe('Height (default: 160)'),
    content: z.string().optional().describe('Text content (for text/todo nodes)'),
    refId: z.string().optional().describe('Reference item ID (for note/csv/todo/schedule/pdf/image nodes)'),
    color: z.string().optional().describe('Node color')
  },
  handler: ({ workspaceId, canvasId, ...data }) =>
    callTool(
      'POST',
      `/api/workspaces/${e(workspaceId)}/canvases/${e(canvasId)}/nodes`,
      data
    )
},
{
  name: 'remove_canvas_node',
  description:
    'Remove a node from a canvas. Connected edges are automatically deleted.',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    canvasId: z.string().describe('Canvas ID'),
    nodeId: z.string().describe('Node ID to remove')
  },
  handler: ({ workspaceId, canvasId, nodeId }) =>
    callTool(
      'DELETE',
      `/api/workspaces/${e(workspaceId)}/canvases/${e(canvasId)}/nodes/${e(nodeId)}`
    )
},
{
  name: 'add_canvas_edge',
  description:
    'Add an edge connecting two nodes. Sides: top, right, bottom, left. Styles: solid, dashed, dotted. Arrow: none, end, both.',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    canvasId: z.string().describe('Canvas ID'),
    fromNode: z.string().describe('Source node ID'),
    toNode: z.string().describe('Target node ID'),
    fromSide: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('Source side'),
    toSide: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('Target side'),
    label: z.string().optional().describe('Edge label'),
    color: z.string().optional().describe('Edge color'),
    style: z.enum(['solid', 'dashed', 'dotted']).optional().describe('Edge style'),
    arrow: z.enum(['none', 'end', 'both']).optional().describe('Arrow direction')
  },
  handler: ({ workspaceId, canvasId, ...data }) =>
    callTool(
      'POST',
      `/api/workspaces/${e(workspaceId)}/canvases/${e(canvasId)}/edges`,
      data
    )
},
{
  name: 'remove_canvas_edge',
  description: 'Remove an edge from a canvas',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    canvasId: z.string().describe('Canvas ID'),
    edgeId: z.string().describe('Edge ID to remove')
  },
  handler: ({ workspaceId, canvasId, edgeId }) =>
    callTool(
      'DELETE',
      `/api/workspaces/${e(workspaceId)}/canvases/${e(canvasId)}/edges/${e(edgeId)}`
    )
},

// ─── Folder Tools ───────────────────────────────────

{
  name: 'create_folder',
  description: 'Create a new folder in a workspace. Omit parentFolderId for root level.',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    parentFolderId: z.string().optional().describe('Parent folder ID (omit for root level)'),
    name: z.string().describe('Folder name')
  },
  handler: ({ workspaceId, parentFolderId, name }) =>
    callTool('POST', `/api/workspaces/${e(workspaceId)}/folders`, { parentFolderId, name })
},
{
  name: 'rename_folder',
  description: 'Rename a folder (changes directory name on disk)',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    folderId: z.string().describe('Folder ID'),
    newName: z.string().describe('New folder name')
  },
  handler: ({ workspaceId, folderId, newName }) =>
    callTool(
      'PATCH',
      `/api/workspaces/${e(workspaceId)}/folders/${e(folderId)}/rename`,
      { newName }
    )
},
{
  name: 'delete_folder',
  description:
    'WARNING: Permanently delete a folder and ALL contents inside it (notes, tables, subfolders). This action cannot be undone.',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    folderId: z.string().describe('Folder ID')
  },
  handler: ({ workspaceId, folderId }) =>
    callTool('DELETE', `/api/workspaces/${e(workspaceId)}/folders/${e(folderId)}`)
},
{
  name: 'move_folder',
  description:
    'Move a folder to a different parent folder. Omit parentFolderId for root. Circular moves are prevented.',
  schema: {
    workspaceId: z.string().describe('Workspace ID'),
    folderId: z.string().describe('Folder ID'),
    parentFolderId: z
      .string()
      .optional()
      .describe('Target parent folder ID (omit for root level)')
  },
  handler: ({ workspaceId, folderId, parentFolderId }) =>
    callTool(
      'PATCH',
      `/api/workspaces/${e(workspaceId)}/folders/${e(folderId)}/move`,
      { parentFolderId }
    )
}
```

### 5.6 Canvas Push Channel — `src/preload/index.ts` (수정)

기존 canvas 객체에 `onChanged` 리스너를 추가한다.

```typescript
// 기존 canvas 객체에 추가
canvas: {
  findByWorkspace: (workspaceId: string, options?: { search?: string }) =>
    ipcRenderer.invoke('canvas:findByWorkspace', workspaceId, options),
  findById: (canvasId: string) => ipcRenderer.invoke('canvas:findById', canvasId),
  create: (workspaceId: string, data: unknown) =>
    ipcRenderer.invoke('canvas:create', workspaceId, data),
  update: (canvasId: string, data: unknown) =>
    ipcRenderer.invoke('canvas:update', canvasId, data),
  updateViewport: (canvasId: string, viewport: unknown) =>
    ipcRenderer.invoke('canvas:updateViewport', canvasId, viewport),
  remove: (canvasId: string) => ipcRenderer.invoke('canvas:remove', canvasId),
  onChanged: createOnChangedListener('canvas:changed')  // <-- 추가
},
```

### 5.7 Canvas Push Channel — `src/preload/index.d.ts` (수정)

```typescript
interface CanvasAPI {
  // ... 기존 메서드들 ...
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void  // 추가
}
```

### 5.8 Canvas Watcher — `src/renderer/src/entities/canvas/model/use-canvas-watcher.ts` (신규)

`useFolderWatcher` 패턴을 따른다 (단순 invalidation, toast 없음 — Canvas에는 relativePath 개념 없으므로).

```typescript
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/** MainLayout에서 호출 — canvas:changed push 이벤트 구독 + React Query invalidation */
export function useCanvasWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.canvas.onChanged((workspaceId: string) => {
      // 캔버스 목록 invalidation
      queryClient.invalidateQueries({ queryKey: ['canvas', 'workspace', workspaceId] })
      // 캔버스 상세 + 노드 + 엣지 전체 invalidation (canvasId 특정 불가)
      queryClient.invalidateQueries({ queryKey: ['canvas', 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['canvasNode'] })
      queryClient.invalidateQueries({ queryKey: ['canvasEdge'] })
    })
    return () => unsub()
  }, [queryClient])
}
```

**핵심 포인트**:
- Canvas broadcast는 `paths: []`로 전달되므로 `changedRelPaths` 파라미터는 사용하지 않음
- `queryKey: ['canvas', 'detail']` — prefix 매칭으로 모든 캔버스 상세 invalidation
- `queryKey: ['canvasNode']` — 모든 캔버스의 노드 invalidation (canvasId를 broadcast에서 전달하지 않으므로)
- 기존 IPC mutation의 `onSuccess` invalidation과 중복 가능하나, re-fetch일 뿐 부작용 없음

### 5.9 Canvas Watcher 등록

**`src/renderer/src/entities/canvas/index.ts`** — export 추가:

```typescript
export { useCanvasWatcher } from './model/use-canvas-watcher'
```

**`src/renderer/src/app/layout/MainLayout.tsx`** — import + 호출 추가:

```typescript
import { useCanvasWatcher } from '@entities/canvas'
// ...
function MainLayout(): React.JSX.Element {
  // ...
  useCanvasWatcher()  // 추가
  // ...
}
```

---

## 6. MCP Tool Descriptions (AI Guide)

| Tool | Description | 위험도 |
|------|-------------|--------|
| `list_tables` | List all CSV tables in a workspace with title, path, preview, and folder info | - |
| `read_table` | Read the full CSV content of a table with encoding info | - |
| `write_table` | Update CSV content. **WARNING: Replaces entire file.** Read first to avoid data loss. | 중 |
| `create_table` | Create a new CSV table. Optionally set initial content. | - |
| `rename_table` | Rename a CSV table (changes file name on disk) | - |
| `delete_table` | Permanently delete a CSV table file. Cannot be undone. | 높 |
| `move_table` | Move a CSV table to a different folder | - |
| `list_canvases` | List all canvases in a workspace | - |
| `read_canvas` | Read canvas with all nodes (including ref data) and edges | - |
| `create_canvas` | Create a new canvas | - |
| `update_canvas` | Update canvas title and/or description | - |
| `delete_canvas` | **WARNING: Deletes canvas + ALL nodes + edges.** Cannot be undone. | 높 |
| `add_canvas_node` | Add a node. Types: text, todo, note, schedule, csv, pdf, image | - |
| `remove_canvas_node` | Remove a node. Connected edges auto-deleted. | 중 |
| `add_canvas_edge` | Add an edge between two nodes | - |
| `remove_canvas_edge` | Remove an edge | - |
| `create_folder` | Create a new folder | - |
| `rename_folder` | Rename a folder (changes directory name) | - |
| `delete_folder` | **WARNING: Deletes folder + ALL contents** (notes, tables, subfolders). Cannot be undone. | 높 |
| `move_folder` | Move a folder. Circular moves prevented. | - |

---

## 7. Broadcast Strategy

### 7.1 채널별 Broadcast 매핑

| 작업 | `folder:changed` | `note:changed` | `csv:changed` | `canvas:changed` |
|------|:-:|:-:|:-:|:-:|
| CSV write/create/rename/delete/move | - | - | paths | - |
| Canvas create/update/delete/node/edge | - | - | - | `[]` |
| Folder create | paths | - | - | - |
| Folder rename/move/delete | paths | `[]` | `[]` | - |

### 7.2 paths 값 상세

| 작업 | paths 값 | 이유 |
|------|---------|------|
| CSV write | `[csv.relativePath]` | 열린 탭의 content refetch |
| CSV rename | `[oldRelPath, newRelPath]` | 양쪽 경로 캐시 갱신 |
| CSV move | `[oldRelPath, newRelPath]` | 양쪽 경로 캐시 갱신 |
| CSV create | `[result.relativePath]` | 목록 + 새 항목 |
| CSV delete | `[csv.relativePath]` | 삭제 항목 캐시 정리 |
| Canvas 전체 | `[]` | relativePath 없음 |
| Folder create | `[result.relativePath]` | 트리 갱신 |
| Folder rename/move | `[result.relativePath]` | 트리 갱신 |
| Folder delete | `[folder.relativePath]` | 트리 갱신 |
| Folder → note:changed/csv:changed | `[]` | 목록 전체 invalidation만 (경로 특정 불가) |

---

## 8. Implementation Order

| Step | File(s) | Description | Dependencies |
|------|---------|-------------|-------------|
| 1 | `src/preload/index.ts` | canvas.onChanged 추가 | - |
| 2 | `src/preload/index.d.ts` | CanvasAPI 타입에 onChanged 추가 | Step 1 |
| 3 | `src/renderer/.../use-canvas-watcher.ts` | Canvas watcher 신규 생성 | Step 2 |
| 4 | `src/renderer/.../canvas/index.ts` | useCanvasWatcher export 추가 | Step 3 |
| 5 | `src/renderer/.../MainLayout.tsx` | useCanvasWatcher() 호출 추가 | Step 4 |
| 6 | `src/main/mcp-api/routes/csv.ts` | 7개 CSV 엔드포인트 (신규) | - |
| 7 | `src/main/mcp-api/routes/canvas.ts` | 9개 Canvas 엔드포인트 (신규) | - |
| 8 | `src/main/mcp-api/routes/folder.ts` | 4개 Folder 엔드포인트 추가 | - |
| 9 | `src/main/mcp-api/routes/index.ts` | registerCsvRoutes, registerCanvasRoutes 등록 | Steps 6-8 |
| 10 | `src/mcp-server/tool-definitions.ts` | 20개 MCP Tool 추가 | Steps 6-9 |
| 11 | MCP 서버 재빌드 | `npm run build:mcp` | Step 10 |
| 12 | 수동 테스트 | Claude Code에서 새 도구 호출 검증 | Steps 1-11 |

---

## 9. File Change Summary

### 9.1 New Files (3)

| File | Description |
|------|-------------|
| `src/main/mcp-api/routes/csv.ts` | 7개 CSV HTTP API 엔드포인트 |
| `src/main/mcp-api/routes/canvas.ts` | 9개 Canvas HTTP API 엔드포인트 |
| `src/renderer/src/entities/canvas/model/use-canvas-watcher.ts` | Canvas push 이벤트 watcher |

### 9.2 Modified Files (6)

| File | Changes |
|------|---------|
| `src/main/mcp-api/routes/folder.ts` | POST, PATCH(rename/move), DELETE 4개 엔드포인트 추가 + folderService/broadcastChanged import |
| `src/main/mcp-api/routes/index.ts` | `registerCsvRoutes`, `registerCanvasRoutes` import + 호출 추가 |
| `src/mcp-server/tool-definitions.ts` | tools 배열에 20개 Tool 정의 추가 |
| `src/preload/index.ts` | canvas 객체에 `onChanged: createOnChangedListener('canvas:changed')` 추가 |
| `src/preload/index.d.ts` | CanvasAPI 인터페이스에 `onChanged` 타입 추가 |
| `src/renderer/src/entities/canvas/index.ts` | `useCanvasWatcher` export 추가 |
| `src/renderer/src/app/layout/MainLayout.tsx` | `useCanvasWatcher` import + 호출 추가 |

### 9.3 변경 파일 통계

- 신규 파일: 3개
- 수정 파일: 7개 (기존 앱 코드 6개 + MCP 서버 1개)
- 삭제 파일: 0개
- DB 스키마 변경: 없음
- 패키지 추가: 없음

# MCP Tools Optimization — Design Document

> Plan: `docs/01-plan/features/mcp-tools-optimization.plan.md`

## Implementation Order

1. `lib/errors.ts` — ValidationError에 details 필드 추가 + router 에러 응답에 details 포함
2. `workspace-watcher.ts` — activeWorkspaceId getter 추가
3. `mcp-api/routes/mcp.ts` — MCP 전용 라우트 파일 + resolveActiveWorkspace 헬퍼
4. `mcp-api/routes/mcp.ts` — 11개 엔드포인트 구현
5. `mcp-server/lib/call-tool.ts` — 에러 응답에 details 포함
6. `mcp-server/tool-definitions.ts` — 11개 도구 재작성
7. `preload/index.ts` + `preload/index.d.ts` — todo:changed 채널 추가
8. `use-todo-watcher.ts` + `MainLayout.tsx` — todo watcher 등록
9. 기존 라우트 등록에 MCP 라우트 추가

## 0. ValidationError details 지원 + Router 에러 응답 확장

### 0-1. errors.ts 수정

```typescript
// src/main/lib/errors.ts
export class ValidationError extends Error {
  details?: Record<string, unknown>
  constructor(message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ValidationError'
    this.details = details
  }
}
```

### 0-2. router.ts 에러 응답에 details 포함

```typescript
// src/main/mcp-api/router.ts — catch 블록 수정
} catch (error) {
  if (error instanceof Error) {
    const status = mapErrorToStatus(error)
    const details = (error as Record<string, unknown>).details
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: error.message,
      errorType: mapErrorToType(error),
      ...(details ? { details } : {})
    }))
  } else {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: String(error), errorType: 'UnknownError' }))
  }
}
```

이를 통해 배치 실패 시 `failedActionIndex`, `completedCount` 등 메타데이터가 MCP 클라이언트에 전달됩니다.

## 1. Active Workspace Resolution

### 1-1. workspace-watcher.ts 변경

```typescript
// src/main/services/workspace-watcher.ts
class WorkspaceWatcherService {
  private activeWorkspaceId: string | null = null
  private activeWorkspacePath: string | null = null

  // 추가
  getActiveWorkspaceId(): string | null {
    return this.activeWorkspaceId
  }

  // ... 기존 코드 유지
}
```

### 1-2. mcp.ts 전체 import + requireBody + export function

```typescript
// src/main/mcp-api/routes/mcp.ts
import type { Router } from '../router'
import { workspaceWatcher } from '../../services/workspace-watcher'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { noteRepository } from '../../repositories/note'
import { csvFileRepository } from '../../repositories/csv-file'
import { folderService } from '../../services/folder'
import { noteService } from '../../services/note'
import { csvFileService } from '../../services/csv-file'
import { canvasService } from '../../services/canvas'
import { canvasNodeService } from '../../services/canvas-node'
import { canvasEdgeService } from '../../services/canvas-edge'
import { todoService } from '../../services/todo'
import { ValidationError, NotFoundError } from '../../lib/errors'
import { broadcastChanged } from '../lib/broadcast'

function requireBody(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required')
  }
}

// ─── 모든 라우트를 이 함수 안에서 등록 ───
export function registerMcpRoutes(router: Router): void {
  // resolveActiveWorkspace, resolveItemType 헬퍼 + 11개 라우트 등록
  // (아래 1-3 ~ 2-3 섹션의 모든 코드가 이 함수 본문 안에 위치)
}
```

### 1-3. resolveActiveWorkspace 헬퍼

```typescript
// registerMcpRoutes 함수 내부
function resolveActiveWorkspace(): string {
  const wsId = workspaceWatcher.getActiveWorkspaceId()
  if (!wsId)
    throw new ValidationError('활성 워크스페이스가 없습니다. Rally에서 워크스페이스를 열어주세요.')
  // 존재 검증
  const ws = workspaceRepository.findById(wsId)
  if (!ws) throw new ValidationError('활성 워크스페이스를 찾을 수 없습니다.')
  return wsId
}
```

## 2. MCP 전용 라우트 (`src/main/mcp-api/routes/mcp.ts`)

단일 파일에 11개 엔드포인트 모두 등록. 기존 서비스 레이어를 직접 호출.

### 2-1. 파일 구조

```
src/main/mcp-api/routes/mcp.ts   ← 신규 (MCP 전용 라우트 전체)
src/main/mcp-api/routes/index.ts ← 수정 (registerMcpRoutes 추가)
```

### 2-2. resolveItemType 헬퍼

```typescript
function resolveItemType(id: string): { type: 'note' | 'table'; row: any } {
  const note = noteRepository.findById(id)
  if (note) return { type: 'note', row: note }
  const csv = csvFileRepository.findById(id)
  if (csv) return { type: 'table', row: csv }
  throw new NotFoundError(`Item not found: ${id}`)
}
```

### 2-3. 엔드포인트 상세 설계

#### GET `/api/mcp/items` → list_items

```typescript
router.addRoute('GET', '/api/mcp/items', () => {
  const wsId = resolveActiveWorkspace()
  const workspace = workspaceRepository.findById(wsId)!

  const folders = folderRepository.findByWorkspaceId(wsId)
  const folderMap = new Map(folders.map((f) => [f.id, f.relativePath]))

  const notes = noteService.readByWorkspaceFromDb(wsId)
  const tables = csvFileService.readByWorkspaceFromDb(wsId)
  const canvases = canvasService.findByWorkspace(wsId)
  const allTodos = todoService.findByWorkspace(wsId)

  return {
    workspace: { id: workspace.id, name: workspace.name, path: workspace.path },
    folders: folders.map((f) => ({ id: f.id, relativePath: f.relativePath, order: f.order })),
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      relativePath: n.relativePath,
      preview: n.preview,
      folderId: n.folderId,
      folderPath: n.folderId ? (folderMap.get(n.folderId) ?? null) : null,
      updatedAt: n.updatedAt.toISOString()
    })),
    tables: tables.map((t) => ({
      id: t.id,
      title: t.title,
      relativePath: t.relativePath,
      description: t.description,
      preview: t.preview,
      folderId: t.folderId,
      folderPath: t.folderId ? (folderMap.get(t.folderId) ?? null) : null,
      updatedAt: t.updatedAt.toISOString()
    })),
    canvases: canvases.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString()
    })),
    todos: {
      active: allTodos.filter((t) => !t.isDone).length,
      completed: allTodos.filter((t) => t.isDone).length,
      total: allTodos.length
    }
  }
})
```

#### GET `/api/mcp/notes/search` → search_notes

```typescript
router.addRoute('GET', '/api/mcp/notes/search', async (_params, _body, query) => {
  const wsId = resolveActiveWorkspace()
  const q = query.get('q') || ''
  if (!q.trim()) return { results: [] }
  const results = await noteService.search(wsId, q)
  return { results }
})
```

#### GET `/api/mcp/content/:id` → read_content

```typescript
router.addRoute('GET', '/api/mcp/content/:id', (params) => {
  const wsId = resolveActiveWorkspace()
  const { type, row } = resolveItemType(params.id)

  if (type === 'note') {
    const content = noteService.readContent(wsId, params.id)
    return { type: 'note', title: row.title, relativePath: row.relativePath, content }
  } else {
    const { content, encoding, columnWidths } = csvFileService.readContent(wsId, params.id)
    return {
      type: 'table',
      title: row.title,
      relativePath: row.relativePath,
      content,
      encoding,
      columnWidths
    }
  }
})
```

#### POST `/api/mcp/content` → write_content

```typescript
router.addRoute<{
  type?: 'note' | 'table'
  id?: string
  title?: string
  folderId?: string
  content: string
}>('POST', '/api/mcp/content', (_, body) => {
  requireBody(body)
  const wsId = resolveActiveWorkspace()

  if (body.id) {
    // UPDATE
    const { type, row } = resolveItemType(body.id)
    if (type === 'note') {
      noteService.writeContent(wsId, body.id, body.content)
      broadcastChanged('note:changed', wsId, [row.relativePath])
    } else {
      csvFileService.writeContent(wsId, body.id, body.content)
      broadcastChanged('csv:changed', wsId, [row.relativePath])
    }
    const updated =
      type === 'note' ? noteRepository.findById(body.id) : csvFileRepository.findById(body.id)
    return {
      type,
      id: body.id,
      title: updated!.title,
      relativePath: updated!.relativePath,
      created: false
    }
  } else {
    // CREATE
    if (!body.type) throw new ValidationError('type is required for create')
    if (!body.title) throw new ValidationError('title is required for create')
    const folderId = body.folderId ?? null

    if (body.type === 'note') {
      const result = noteService.create(wsId, folderId, body.title)
      if (body.content) noteService.writeContent(wsId, result.id, body.content)
      broadcastChanged('note:changed', wsId, [result.relativePath])
      return {
        type: 'note',
        id: result.id,
        title: result.title,
        relativePath: result.relativePath,
        created: true
      }
    } else {
      const result = csvFileService.create(wsId, folderId, body.title)
      if (body.content) csvFileService.writeContent(wsId, result.id, body.content)
      broadcastChanged('csv:changed', wsId, [result.relativePath])
      return {
        type: 'table',
        id: result.id,
        title: result.title,
        relativePath: result.relativePath,
        created: true
      }
    }
  }
})
```

#### POST `/api/mcp/items/batch` → manage_items

```typescript
router.addRoute<{ actions: any[] }>('POST', '/api/mcp/items/batch', (_, body) => {
  requireBody(body)
  const wsId = resolveActiveWorkspace()
  if (!Array.isArray(body.actions) || body.actions.length === 0)
    throw new ValidationError('actions array is required')

  // validate-first: 모든 대상 존재 확인
  const resolved = body.actions.map((a: any, i: number) => {
    try {
      return { ...a, ...resolveItemType(a.id) }
    } catch (e) {
      throw new ValidationError((e as Error).message, { failedActionIndex: i })
    }
  })

  const results: any[] = []
  const noteAffected: string[] = []
  const tableAffected: string[] = []

  for (const [i, action] of resolved.entries()) {
    try {
      if (action.action === 'rename') {
        if (action.type === 'note') {
          const old = action.row.relativePath
          const result = noteService.rename(wsId, action.id, action.newName)
          noteAffected.push(old, result.relativePath)
        } else {
          const old = action.row.relativePath
          const result = csvFileService.rename(wsId, action.id, action.newName)
          tableAffected.push(old, result.relativePath)
        }
      } else if (action.action === 'move') {
        if (action.type === 'note') {
          const old = action.row.relativePath
          const result = noteService.move(wsId, action.id, action.targetFolderId ?? null, 0)
          noteAffected.push(old, result.relativePath)
        } else {
          const old = action.row.relativePath
          const result = csvFileService.move(wsId, action.id, action.targetFolderId ?? null, 0)
          tableAffected.push(old, result.relativePath)
        }
      } else if (action.action === 'delete') {
        if (action.type === 'note') {
          noteAffected.push(action.row.relativePath)
          noteService.remove(wsId, action.id)
        } else {
          tableAffected.push(action.row.relativePath)
          csvFileService.remove(wsId, action.id)
        }
      }
      results.push({ action: action.action, type: action.type, id: action.id, success: true })
    } catch (e) {
      throw new ValidationError((e as Error).message, {
        failedActionIndex: i,
        completedCount: results.length
      })
    }
  }

  if (noteAffected.length > 0) broadcastChanged('note:changed', wsId, noteAffected)
  if (tableAffected.length > 0) broadcastChanged('csv:changed', wsId, tableAffected)

  return { results }
})
```

#### POST `/api/mcp/folders/batch` → manage_folders

```typescript
router.addRoute<{ actions: any[] }>('POST', '/api/mcp/folders/batch', (_, body) => {
  requireBody(body)
  const wsId = resolveActiveWorkspace()
  if (!Array.isArray(body.actions) || body.actions.length === 0)
    throw new ValidationError('actions array is required')

  // 순차 실행 + 개별 검증 (폴더 경로 연쇄 변경 대응)
  const results: any[] = []
  const affectedPaths: string[] = []
  let hasFolderChange = false

  for (const [i, action] of body.actions.entries()) {
    try {
      if (action.action === 'create') {
        const result = folderService.create(wsId, action.parentFolderId ?? null, action.name)
        affectedPaths.push(result.relativePath)
        results.push({ action: 'create', id: result.id, success: true })
      } else if (action.action === 'rename') {
        const result = folderService.rename(wsId, action.folderId, action.newName)
        affectedPaths.push(result.relativePath)
        hasFolderChange = true
        results.push({ action: 'rename', id: action.folderId, success: true })
      } else if (action.action === 'move') {
        const result = folderService.move(wsId, action.folderId, action.parentFolderId ?? null, 0)
        affectedPaths.push(result.relativePath)
        hasFolderChange = true
        results.push({ action: 'move', id: action.folderId, success: true })
      } else if (action.action === 'delete') {
        const folder = folderRepository.findById(action.folderId)
        if (!folder) throw new NotFoundError(`Folder not found: ${action.folderId}`)
        affectedPaths.push(folder.relativePath)
        folderService.remove(wsId, action.folderId)
        hasFolderChange = true
        results.push({ action: 'delete', id: action.folderId, success: true })
      }
    } catch (e) {
      throw new ValidationError((e as Error).message, {
        failedActionIndex: i,
        completedCount: results.length
      })
    }
  }

  broadcastChanged('folder:changed', wsId, affectedPaths)
  if (hasFolderChange) {
    broadcastChanged('note:changed', wsId, [])
    broadcastChanged('csv:changed', wsId, [])
  }

  return { results }
})
```

#### GET `/api/mcp/canvases/:canvasId` → read_canvas

```typescript
router.addRoute('GET', '/api/mcp/canvases/:canvasId', (params) => {
  resolveActiveWorkspace() // 활성 워크스페이스 검증만
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
```

#### POST `/api/mcp/canvases` → create_canvas

```typescript
router.addRoute<{
  title: string
  description?: string
  nodes?: any[]
  edges?: any[]
}>('POST', '/api/mcp/canvases', (_, body) => {
  requireBody(body)
  const wsId = resolveActiveWorkspace()

  // edges가 있는데 nodes가 없으면 에러
  if (body.edges?.length && !body.nodes?.length)
    throw new ValidationError('edges require nodes to reference')

  const canvas = canvasService.create(wsId, {
    title: body.title,
    description: body.description
  })

  const createdNodes: { index: number; id: string; [key: string]: any }[] = []

  if (body.nodes?.length) {
    for (const [index, node] of body.nodes.entries()) {
      const result = canvasNodeService.create(canvas.id, {
        type: node.type,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        content: node.content,
        refId: node.refId,
        color: node.color
      })
      createdNodes.push({ index, id: result.id, type: result.type, x: result.x, y: result.y })
    }
  }

  const createdEdges: any[] = []

  if (body.edges?.length) {
    for (const edge of body.edges) {
      // index → 실제 ID 치환
      const fromNode = createdNodes[edge.fromNodeIndex]?.id
      const toNode = createdNodes[edge.toNodeIndex]?.id
      if (!fromNode) throw new ValidationError(`Invalid fromNodeIndex: ${edge.fromNodeIndex}`)
      if (!toNode) throw new ValidationError(`Invalid toNodeIndex: ${edge.toNodeIndex}`)

      const result = canvasEdgeService.create(canvas.id, {
        fromNode,
        toNode,
        fromSide: edge.fromSide,
        toSide: edge.toSide,
        label: edge.label,
        color: edge.color,
        style: edge.style,
        arrow: edge.arrow
      })
      createdEdges.push(result)
    }
  }

  broadcastChanged('canvas:changed', wsId, [])

  return {
    canvas: { id: canvas.id, title: canvas.title, description: canvas.description },
    nodes: createdNodes,
    edges: createdEdges
  }
})
```

#### POST `/api/mcp/canvases/:canvasId/edit` → edit_canvas

```typescript
router.addRoute<{ actions: any[] }>('POST', '/api/mcp/canvases/:canvasId/edit', (params, body) => {
  requireBody(body)
  const wsId = resolveActiveWorkspace()
  if (!Array.isArray(body.actions) || body.actions.length === 0)
    throw new ValidationError('actions array is required')
  const actions = body.actions

  // delete 단독 실행 검증
  const hasDelete = actions.some((a: any) => a.action === 'delete')
  if (hasDelete && actions.length > 1) throw new ValidationError('delete action must be used alone')

  if (hasDelete) {
    canvasService.remove(params.canvasId)
    broadcastChanged('canvas:changed', wsId, [])
    return { results: [{ action: 'delete', success: true }] }
  }

  // tempId → realId 매핑
  const tempIdMap = new Map<string, string>()
  const results: any[] = []

  for (const action of actions) {
    if (action.action === 'update') {
      canvasService.update(params.canvasId, {
        title: action.title,
        description: action.description
      })
      results.push({ action: 'update', success: true })
    } else if (action.action === 'add_node') {
      const result = canvasNodeService.create(params.canvasId, {
        type: action.type,
        x: action.x,
        y: action.y,
        width: action.width,
        height: action.height,
        content: action.content,
        refId: action.refId,
        color: action.color
      })
      if (action.tempId) tempIdMap.set(action.tempId, result.id)
      results.push({ action: 'add_node', tempId: action.tempId || undefined, id: result.id })
    } else if (action.action === 'remove_node') {
      canvasNodeService.remove(action.nodeId)
      results.push({ action: 'remove_node', nodeId: action.nodeId, success: true })
    } else if (action.action === 'add_edge') {
      // tempId 치환
      const fromNode = tempIdMap.get(action.fromNode) ?? action.fromNode
      const toNode = tempIdMap.get(action.toNode) ?? action.toNode
      const result = canvasEdgeService.create(params.canvasId, {
        fromNode,
        toNode,
        fromSide: action.fromSide,
        toSide: action.toSide,
        label: action.label,
        color: action.color,
        style: action.style,
        arrow: action.arrow
      })
      results.push({ action: 'add_edge', id: result.id })
    } else if (action.action === 'remove_edge') {
      canvasEdgeService.remove(action.edgeId)
      results.push({ action: 'remove_edge', edgeId: action.edgeId, success: true })
    }
  }

  broadcastChanged('canvas:changed', wsId, [])
  return { results }
})
```

#### GET `/api/mcp/todos` → list_todos

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

#### POST `/api/mcp/todos/batch` → manage_todos

```typescript
router.addRoute<{ actions: any[] }>('POST', '/api/mcp/todos/batch', (_, body) => {
  requireBody(body)
  const wsId = resolveActiveWorkspace()
  if (!Array.isArray(body.actions) || body.actions.length === 0)
    throw new ValidationError('actions array is required')

  const results: any[] = []

  for (const [i, action] of body.actions.entries()) {
    try {
      if (action.action === 'create') {
        const result = todoService.create(wsId, {
          title: action.title,
          description: action.description,
          status: action.status,
          priority: action.priority,
          parentId: action.parentId,
          dueDate: action.dueDate ? new Date(action.dueDate) : undefined,
          startDate: action.startDate ? new Date(action.startDate) : undefined
        })
        results.push({ action: 'create', id: result.id, success: true })
      } else if (action.action === 'update') {
        todoService.update(action.id, {
          title: action.title,
          description: action.description,
          status: action.status,
          priority: action.priority,
          isDone: action.isDone,
          dueDate:
            action.dueDate === null ? null : action.dueDate ? new Date(action.dueDate) : undefined,
          startDate:
            action.startDate === null
              ? null
              : action.startDate
                ? new Date(action.startDate)
                : undefined
        })
        results.push({ action: 'update', id: action.id, success: true })
      } else if (action.action === 'delete') {
        todoService.remove(action.id)
        results.push({ action: 'delete', id: action.id, success: true })
      }
    } catch (e) {
      throw new ValidationError((e as Error).message, {
        failedActionIndex: i,
        completedCount: results.length
      })
    }
  }

  // NOTE: todo:changed 채널은 현재 renderer에 리스너가 없음.
  // 구현 시 preload + renderer에 todo watcher 추가 필요 (아래 2-4 참고)
  broadcastChanged('todo:changed', wsId, [])
  return { results }
})
```

### 2-4. todo:changed 채널 추가 (필수 전제조건)

현재 `todo:changed` 브로드캐스트 채널이 renderer에 등록되어 있지 않아, MCP를 통한 todo 변경이 UI에 반영되지 않음. 아래 추가 필요:

**preload/index.ts:**

```typescript
todo: {
  // ... 기존 IPC 메서드 유지
  onChanged: createOnChangedListener('todo:changed')
}
```

**preload/index.d.ts — TodoAPI에 onChanged 추가:**

```typescript
interface TodoAPI {
  // ... 기존 메서드 유지
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}
```

**renderer에 use-todo-watcher.ts 추가:**

```typescript
// src/renderer/src/entities/todo/model/use-todo-watcher.ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/** MainLayout에서 호출 — todo:changed push 이벤트 구독 + React Query invalidation */
export function useTodoWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.todo.onChanged((workspaceId: string) => {
      queryClient.invalidateQueries({ queryKey: ['todo', 'workspace', workspaceId] })
    })
    return () => unsub()
  }, [queryClient])
}
```

**entities/todo/index.ts — barrel export 추가:**

```typescript
export { useTodoWatcher } from './model/use-todo-watcher'
```

**MainLayout.tsx에 watcher 등록:**

```typescript
import { useTodoWatcher } from '@entities/todo'
// ... 컴포넌트 내부
useTodoWatcher()
```

### 2-5. 라우트 등록

```typescript
// src/main/mcp-api/routes/index.ts
import { registerMcpRoutes } from './mcp'

export function registerAllRoutes(router: Router): void {
  // 기존 라우트 유지
  registerWorkspaceRoutes(router)
  registerFolderRoutes(router)
  registerSearchRoutes(router)
  registerNoteRoutes(router)
  registerCsvRoutes(router)
  registerCanvasRoutes(router)

  // MCP 전용 라우트 추가
  registerMcpRoutes(router)
}
```

## 3. callTool 에러 응답 개선 (`src/mcp-server/lib/call-tool.ts`)

배치 에러 시 `details`(failedActionIndex, completedCount)가 MCP 클라이언트에 전달되도록 에러 응답을 JSON 전체로 변경:

```typescript
if (status !== 200) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: true }
}
```

기존: `Error: ${data.error}` → 변경: `JSON.stringify(data)` (error, errorType, details 모두 포함)

## 4. MCP Server Tool Definitions (`src/mcp-server/tool-definitions.ts`)

29개 도구를 11개로 재작성. 모든 workspaceId 파라미터 제거.

```typescript
const tools: ToolDefinition[] = [
  {
    name: 'list_items',
    description:
      'List all items (folders, notes, tables, canvases, todo summary) in the active workspace',
    schema: {},
    handler: () => callTool('GET', '/api/mcp/items')
  },
  {
    name: 'search_notes',
    description: 'Search notes by title or content. Returns up to 50 results.',
    schema: {
      query: z.string().describe('Search query (case-insensitive)')
    },
    handler: ({ query }) => callTool('GET', `/api/mcp/notes/search?q=${e(query)}`)
  },
  {
    name: 'read_content',
    description:
      'Read the full content of a note (markdown) or table (CSV). Auto-detects type by ID.',
    schema: {
      id: z.string().describe('Note or table ID (from list_items)')
    },
    handler: ({ id }) => callTool('GET', `/api/mcp/content/${e(id)}`)
  },
  {
    name: 'write_content',
    description: `Create or update a note/table. If id is provided, updates existing content. If not, creates new.
WARNING: When updating a note, image references (![](/.images/xxx.png)) removed from new content will be permanently deleted from disk. Always preserve existing image references.`,
    schema: {
      type: z
        .enum(['note', 'table'])
        .optional()
        .describe('Required for create, auto-detected for update'),
      id: z.string().optional().describe('Item ID — provide to update, omit to create'),
      title: z.string().optional().describe('Title — required for create'),
      folderId: z.string().optional().describe('Folder ID for create (omit for root)'),
      content: z.string().describe('Full content (markdown for note, CSV for table)')
    },
    handler: (args) => callTool('POST', '/api/mcp/content', args)
  },
  {
    name: 'manage_items',
    description: 'Batch rename, move, or delete notes and tables. Type is auto-detected by ID.',
    schema: {
      actions: z
        .array(
          z.union([
            z.object({ action: z.literal('rename'), id: z.string(), newName: z.string() }),
            z.object({
              action: z.literal('move'),
              id: z.string(),
              targetFolderId: z.string().optional()
            }),
            z.object({ action: z.literal('delete'), id: z.string() })
          ])
        )
        .describe('Array of actions to execute')
    },
    handler: (args) => callTool('POST', '/api/mcp/items/batch', args)
  },
  {
    name: 'manage_folders',
    description: 'Batch create, rename, move, or delete folders. Actions execute sequentially.',
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              name: z.string(),
              parentFolderId: z.string().optional()
            }),
            z.object({ action: z.literal('rename'), folderId: z.string(), newName: z.string() }),
            z.object({
              action: z.literal('move'),
              folderId: z.string(),
              parentFolderId: z.string().optional()
            }),
            z.object({ action: z.literal('delete'), folderId: z.string() })
          ])
        )
        .describe('Array of folder actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/folders/batch', args)
  },
  {
    name: 'read_canvas',
    description:
      'Read a canvas with all nodes and edges. Nodes include reference data for linked items.',
    schema: {
      canvasId: z.string().describe('Canvas ID')
    },
    handler: ({ canvasId }) => callTool('GET', `/api/mcp/canvases/${e(canvasId)}`)
  },
  {
    name: 'create_canvas',
    description:
      'Create a canvas with optional nodes and edges in one call. Edges reference nodes by array index.',
    schema: {
      title: z.string().describe('Canvas title'),
      description: z.string().optional().describe('Canvas description'),
      nodes: z
        .array(
          z.object({
            type: z.enum(['text', 'todo', 'note', 'schedule', 'csv', 'pdf', 'image']),
            x: z.number(),
            y: z.number(),
            width: z.number().optional(),
            height: z.number().optional(),
            content: z.string().optional(),
            refId: z.string().optional(),
            color: z.string().optional()
          })
        )
        .optional()
        .describe('Nodes to create'),
      edges: z
        .array(
          z.object({
            fromNodeIndex: z.number().describe('Source node index in nodes array'),
            toNodeIndex: z.number().describe('Target node index in nodes array'),
            fromSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
            toSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
            label: z.string().optional(),
            color: z.string().optional(),
            style: z.enum(['solid', 'dashed', 'dotted']).optional(),
            arrow: z.enum(['none', 'end', 'both']).optional()
          })
        )
        .optional()
        .describe('Edges connecting nodes by index')
    },
    handler: (args) => callTool('POST', '/api/mcp/canvases', args)
  },
  {
    name: 'edit_canvas',
    description: `Edit a canvas: update metadata, delete canvas, add/remove nodes and edges in one batch.
Delete must be the only action. Use tempId on add_node to reference new nodes in add_edge.`,
    schema: {
      canvasId: z.string().describe('Canvas ID'),
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('update'),
              title: z.string().optional(),
              description: z.string().optional()
            }),
            z.object({ action: z.literal('delete') }),
            z.object({
              action: z.literal('add_node'),
              tempId: z.string().optional(),
              type: z.enum(['text', 'todo', 'note', 'schedule', 'csv', 'pdf', 'image']),
              x: z.number(),
              y: z.number(),
              width: z.number().optional(),
              height: z.number().optional(),
              content: z.string().optional(),
              refId: z.string().optional(),
              color: z.string().optional()
            }),
            z.object({ action: z.literal('remove_node'), nodeId: z.string() }),
            z.object({
              action: z.literal('add_edge'),
              fromNode: z.string(),
              toNode: z.string(),
              fromSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
              toSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
              label: z.string().optional(),
              color: z.string().optional(),
              style: z.enum(['solid', 'dashed', 'dotted']).optional(),
              arrow: z.enum(['none', 'end', 'both']).optional()
            }),
            z.object({ action: z.literal('remove_edge'), edgeId: z.string() })
          ])
        )
        .describe('Actions to perform on the canvas')
    },
    handler: ({ canvasId, ...rest }) =>
      callTool('POST', `/api/mcp/canvases/${e(canvasId)}/edit`, rest)
  },
  {
    name: 'list_todos',
    description: 'List all todos in the active workspace. Supports filter: all, active, completed.',
    schema: {
      filter: z.enum(['all', 'active', 'completed']).optional().describe('Filter (default: all)')
    },
    handler: ({ filter }) => callTool('GET', `/api/mcp/todos${filter ? `?filter=${filter}` : ''}`)
  },
  {
    name: 'manage_todos',
    description:
      'Batch create, update, or delete todos. Supports subtodos via parentId. Status/isDone auto-sync.',
    schema: {
      actions: z
        .array(
          z.union([
            z.object({
              action: z.literal('create'),
              title: z.string(),
              description: z.string().optional(),
              status: z.enum(['할일', '진행중', '완료', '보류']).optional(),
              priority: z.enum(['high', 'medium', 'low']).optional(),
              parentId: z.string().optional(),
              dueDate: z.string().optional().describe('ISO 8601 date'),
              startDate: z.string().optional().describe('ISO 8601 date')
            }),
            z.object({
              action: z.literal('update'),
              id: z.string(),
              title: z.string().optional(),
              description: z.string().optional(),
              status: z.enum(['할일', '진행중', '완료', '보류']).optional(),
              priority: z.enum(['high', 'medium', 'low']).optional(),
              isDone: z.boolean().optional(),
              dueDate: z.string().nullable().optional(),
              startDate: z.string().nullable().optional()
            }),
            z.object({ action: z.literal('delete'), id: z.string() })
          ])
        )
        .describe('Array of todo actions')
    },
    handler: (args) => callTool('POST', '/api/mcp/todos/batch', args)
  }
]
```

## 5. 변경 파일 요약

| 파일                                                       | 변경                                      | 신규/수정   |
| ---------------------------------------------------------- | ----------------------------------------- | ----------- |
| `src/main/lib/errors.ts`                                   | `ValidationError`에 `details?` 필드 추가  | 수정 (2줄)  |
| `src/main/mcp-api/router.ts`                               | 에러 응답에 `details` 포함                | 수정 (1줄)  |
| `src/main/services/workspace-watcher.ts`                   | `getActiveWorkspaceId()` getter 추가      | 수정 (3줄)  |
| `src/main/mcp-api/routes/mcp.ts`                           | MCP 전용 라우트 11개 엔드포인트           | **신규**    |
| `src/main/mcp-api/routes/index.ts`                         | `registerMcpRoutes` 호출 추가             | 수정 (2줄)  |
| `src/mcp-server/lib/call-tool.ts`                          | 에러 응답에 details 포함 (JSON 전체 반환) | 수정 (1줄)  |
| `src/mcp-server/tool-definitions.ts`                       | 29개 → 11개 도구 전면 재작성              | 수정 (전체) |
| `src/preload/index.ts`                                     | `todo.onChanged` 리스너 추가              | 수정 (1줄)  |
| `src/preload/index.d.ts`                                   | `TodoAPI`에 `onChanged` 타입 추가         | 수정 (1줄)  |
| `src/renderer/src/entities/todo/model/use-todo-watcher.ts` | todo:changed 구독 + invalidation          | **신규**    |
| `src/renderer/src/entities/todo/index.ts`                  | `useTodoWatcher` barrel export 추가       | 수정 (1줄)  |
| `src/renderer/src/app/layout/MainLayout.tsx`               | `useTodoWatcher()` 호출 + import 추가     | 수정 (2줄)  |

기존 파일 변경 최소화. 신규 파일 2개 + 전면 재작성 1개.

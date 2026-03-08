# Design: Canvas Visualization Tool

> **Summary**: Obsidian Canvas 스타일 무한 캔버스 시각화 도구. `@xyflow/react` v12 기반으로 노드 배치, 베지어 엣지, ref 연동을 구현한다.
>
> **Date**: 2026-03-02
> **Status**: Draft
> **Planning Doc**: [canvas-visualization.plan.md](../../01-plan/features/canvas-visualization.plan.md)

---

## 0. 구현 우선순위

```
[Phase 1] 캔버스 코어 + 엣지 (MVP)
  1-A. DB 스키마 (4개) + 마이그레이션
  1-B. Repository (3개 신규 + 6개 기존 확장)
  1-C. Service (3개)
  1-D. IPC (3개) + index.ts 등록
  1-E. Preload Bridge (index.d.ts + index.ts)
  1-F. 탭 시스템 등록 (tab-url.ts, pane-routes.tsx)
  1-G. Entity 레이어 (entities/canvas/)
  1-H. 캔버스 리스트 페이지 (pages/canvas/)
  1-I. 캔버스 디테일 페이지 (pages/canvas-detail/)
  1-J. 캔버스 위젯 (widgets/canvas-board/)

[Phase 2] 고급 기능
  2-A. 그룹 CRUD (Repo + Service + IPC)
  2-B. Entity Link 통합 (5개 파일 수정)
  2-C. ref 노드 추가 다이얼로그 (features/canvas/add-ref-node/)
  2-D. 엣지 라벨 편집, 엣지 컨텍스트 메뉴

[Phase 3] 폴리싱
  3-A. 자동 레이아웃 (@dagrejs/dagre)
  3-B. 단축키 시스템
  3-C. 캔버스 내보내기
```

---

## 1. DB Schema

### 1.1 `src/main/db/schema/canvas.ts` (신규)

```typescript
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export const canvases = sqliteTable(
  'canvases',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    viewportX: real('viewport_x').notNull().default(0),
    viewportY: real('viewport_y').notNull().default(0),
    viewportZoom: real('viewport_zoom').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [index('idx_canvases_workspace').on(t.workspaceId)]
)
```

### 1.2 `src/main/db/schema/canvas-node.ts` (신규)

```typescript
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { isNotNull } from 'drizzle-orm'
import { canvases } from './canvas'

export type CanvasNodeType = 'text' | 'todo' | 'note' | 'schedule' | 'csv' | 'pdf' | 'image'
export const CANVAS_NODE_TYPES: CanvasNodeType[] = [
  'text',
  'todo',
  'note',
  'schedule',
  'csv',
  'pdf',
  'image'
]

export const canvasNodes = sqliteTable(
  'canvas_nodes',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['text', 'todo', 'note', 'schedule', 'csv', 'pdf', 'image']
    }).notNull(),
    refId: text('ref_id'),
    x: real('x').notNull(),
    y: real('y').notNull(),
    width: real('width').notNull().default(260),
    height: real('height').notNull().default(160),
    color: text('color'),
    content: text('content'),
    zIndex: integer('z_index').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    index('idx_canvas_nodes_canvas').on(t.canvasId),
    index('idx_canvas_nodes_ref').on(t.type, t.refId).where(isNotNull(t.refId))
  ]
)
```

### 1.3 `src/main/db/schema/canvas-edge.ts` (신규)

```typescript
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { canvases } from './canvas'
import { canvasNodes } from './canvas-node'

export const canvasEdges = sqliteTable(
  'canvas_edges',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    fromNode: text('from_node')
      .notNull()
      .references(() => canvasNodes.id, { onDelete: 'cascade' }),
    toNode: text('to_node')
      .notNull()
      .references(() => canvasNodes.id, { onDelete: 'cascade' }),
    fromSide: text('from_side', { enum: ['top', 'right', 'bottom', 'left'] })
      .notNull()
      .default('right'),
    toSide: text('to_side', { enum: ['top', 'right', 'bottom', 'left'] })
      .notNull()
      .default('left'),
    label: text('label'),
    color: text('color'),
    style: text('style', { enum: ['solid', 'dashed', 'dotted'] })
      .notNull()
      .default('solid'),
    arrow: text('arrow', { enum: ['none', 'end', 'both'] })
      .notNull()
      .default('end'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [index('idx_canvas_edges_canvas').on(t.canvasId)]
)
```

### 1.4 `src/main/db/schema/canvas-group.ts` (신규 — Phase 2 사용)

```typescript
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { canvases } from './canvas'

export const canvasGroups = sqliteTable(
  'canvas_groups',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    label: text('label'),
    x: real('x').notNull(),
    y: real('y').notNull(),
    width: real('width').notNull(),
    height: real('height').notNull(),
    color: text('color'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [index('idx_canvas_groups_canvas').on(t.canvasId)]
)
```

### 1.5 `src/main/db/schema/index.ts` 수정

```typescript
// 기존 export에 추가
export { canvases } from './canvas'
export { canvasNodes } from './canvas-node'
export { canvasEdges } from './canvas-edge'
export { canvasGroups } from './canvas-group'
```

### 1.6 마이그레이션

```bash
npm run db:generate
npm run db:migrate
```

---

## 2. Repository

### 2.1 `src/main/repositories/canvas.ts` (신규)

```typescript
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { canvases } from '../db/schema'

export type Canvas = typeof canvases.$inferSelect
export type CanvasInsert = typeof canvases.$inferInsert

export const canvasRepository = {
  findByWorkspaceId(workspaceId: string): Canvas[] {
    return db.select().from(canvases).where(eq(canvases.workspaceId, workspaceId)).all()
  },

  findById(id: string): Canvas | undefined {
    return db.select().from(canvases).where(eq(canvases.id, id)).get()
  },

  create(data: CanvasInsert): Canvas {
    return db.insert(canvases).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<Pick<Canvas, 'title' | 'description' | 'updatedAt'>>
  ): Canvas | undefined {
    return db.update(canvases).set(data).where(eq(canvases.id, id)).returning().get()
  },

  updateViewport(
    id: string,
    viewport: { viewportX: number; viewportY: number; viewportZoom: number }
  ): void {
    db.update(canvases).set(viewport).where(eq(canvases.id, id)).run()
  },

  delete(id: string): void {
    db.delete(canvases).where(eq(canvases.id, id)).run()
  }
}
```

### 2.2 `src/main/repositories/canvas-node.ts` (신규)

```typescript
import { eq, inArray } from 'drizzle-orm'
import { db } from '../db'
import { canvasNodes } from '../db/schema'

export type CanvasNode = typeof canvasNodes.$inferSelect
export type CanvasNodeInsert = typeof canvasNodes.$inferInsert

export const canvasNodeRepository = {
  findByCanvasId(canvasId: string): CanvasNode[] {
    return db.select().from(canvasNodes).where(eq(canvasNodes.canvasId, canvasId)).all()
  },

  findById(id: string): CanvasNode | undefined {
    return db.select().from(canvasNodes).where(eq(canvasNodes.id, id)).get()
  },

  findByIds(ids: string[]): CanvasNode[] {
    if (ids.length === 0) return []
    const CHUNK = 900
    const results: CanvasNode[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      results.push(...db.select().from(canvasNodes).where(inArray(canvasNodes.id, chunk)).all())
    }
    return results
  },

  create(data: CanvasNodeInsert): CanvasNode {
    return db.insert(canvasNodes).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<
      Pick<CanvasNode, 'content' | 'color' | 'width' | 'height' | 'zIndex' | 'updatedAt'>
    >
  ): CanvasNode | undefined {
    return db.update(canvasNodes).set(data).where(eq(canvasNodes.id, id)).returning().get()
  },

  bulkUpdatePositions(updates: { id: string; x: number; y: number }[]): void {
    if (updates.length === 0) return
    const now = Date.now()
    const stmt = db.$client.prepare(
      'UPDATE canvas_nodes SET x = ?, y = ?, updated_at = ? WHERE id = ?'
    )
    db.$client.transaction(() => {
      for (const u of updates) {
        stmt.run(u.x, u.y, now, u.id)
      }
    })()
  },

  delete(id: string): void {
    db.delete(canvasNodes).where(eq(canvasNodes.id, id)).run()
  }
}
```

### 2.3 `src/main/repositories/canvas-edge.ts` (신규)

```typescript
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { canvasEdges } from '../db/schema'

export type CanvasEdge = typeof canvasEdges.$inferSelect
export type CanvasEdgeInsert = typeof canvasEdges.$inferInsert

export const canvasEdgeRepository = {
  findByCanvasId(canvasId: string): CanvasEdge[] {
    return db.select().from(canvasEdges).where(eq(canvasEdges.canvasId, canvasId)).all()
  },

  findById(id: string): CanvasEdge | undefined {
    return db.select().from(canvasEdges).where(eq(canvasEdges.id, id)).get()
  },

  create(data: CanvasEdgeInsert): CanvasEdge {
    return db.insert(canvasEdges).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<Pick<CanvasEdge, 'fromSide' | 'toSide' | 'label' | 'color' | 'style' | 'arrow'>>
  ): CanvasEdge | undefined {
    return db.update(canvasEdges).set(data).where(eq(canvasEdges.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(canvasEdges).where(eq(canvasEdges.id, id)).run()
  }
}
```

### 2.4 기존 Repository 확장 — `findByIds()` 추가 (6개 파일)

각 repository에 동일한 패턴으로 추가. todo를 예시로:

**`src/main/repositories/todo.ts`** — 추가:

```typescript
  findByIds(ids: string[]): Todo[] {
    if (ids.length === 0) return []
    const CHUNK = 900
    const results: Todo[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      results.push(...db.select().from(todos).where(inArray(todos.id, chunk)).all())
    }
    return results
  },
```

> `inArray` import 필요 — todo.ts는 이미 import됨. 나머지 5개 파일(`note.ts`, `schedule.ts`, `csv-file.ts`, `pdf-file.ts`, `image-file.ts`)에 `inArray` import 확인 후 추가.

---

## 3. Service

### 3.1 `src/main/services/canvas.ts` (신규)

```typescript
import { nanoid } from 'nanoid'
import { NotFoundError } from '../lib/errors'
import { canvasRepository } from '../repositories/canvas'
import { workspaceRepository } from '../repositories/workspace'

export interface CanvasItem {
  id: string
  workspaceId: string
  title: string
  description: string
  viewportX: number
  viewportY: number
  viewportZoom: number
  createdAt: Date
  updatedAt: Date
}

function toCanvasItem(row: NonNullable<ReturnType<typeof canvasRepository.findById>>): CanvasItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    description: row.description,
    viewportX: row.viewportX,
    viewportY: row.viewportY,
    viewportZoom: row.viewportZoom,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as number),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as number)
  }
}

export const canvasService = {
  findByWorkspace(workspaceId: string): CanvasItem[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    return canvasRepository.findByWorkspaceId(workspaceId).map(toCanvasItem)
  },

  findById(canvasId: string): CanvasItem {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    return toCanvasItem(canvas)
  },

  create(workspaceId: string, data: { title: string; description?: string }): CanvasItem {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    const now = new Date()
    const row = canvasRepository.create({
      id: nanoid(),
      workspaceId,
      title: data.title.trim(),
      description: data.description?.trim() ?? '',
      createdAt: now,
      updatedAt: now
    })
    return toCanvasItem(row)
  },

  update(canvasId: string, data: { title?: string; description?: string }): CanvasItem {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    const updated = canvasRepository.update(canvasId, {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      updatedAt: new Date()
    })
    if (!updated) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    return toCanvasItem(updated)
  },

  updateViewport(canvasId: string, viewport: { x: number; y: number; zoom: number }): void {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    canvasRepository.updateViewport(canvasId, {
      viewportX: viewport.x,
      viewportY: viewport.y,
      viewportZoom: viewport.zoom
    })
  },

  remove(canvasId: string): void {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    // Phase 2: entityLinkService.removeAllLinks('canvas', canvasId) 호출 추가
    canvasRepository.delete(canvasId)
  }
}
```

### 3.2 `src/main/services/canvas-node.ts` (신규)

```typescript
import { nanoid } from 'nanoid'
import { NotFoundError } from '../lib/errors'
import { canvasNodeRepository } from '../repositories/canvas-node'
import { canvasRepository } from '../repositories/canvas'
import { todoRepository } from '../repositories/todo'
import { noteRepository } from '../repositories/note'
import { scheduleRepository } from '../repositories/schedule'
import { csvFileRepository } from '../repositories/csv-file'
import { pdfFileRepository } from '../repositories/pdf-file'
import { imageFileRepository } from '../repositories/image-file'
import type { CanvasNodeType } from '../db/schema/canvas-node'

export interface CanvasNodeItem {
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
  createdAt: Date
  updatedAt: Date
  refTitle?: string
  refPreview?: string
}

export interface CreateCanvasNodeData {
  type: CanvasNodeType
  refId?: string
  x: number
  y: number
  width?: number
  height?: number
  color?: string
  content?: string
}

export interface UpdateCanvasNodeData {
  content?: string
  color?: string
  width?: number
  height?: number
  zIndex?: number
}

interface RefData {
  title: string
  preview: string
}

function toCanvasNodeItem(
  row: NonNullable<ReturnType<typeof canvasNodeRepository.findById>>,
  refData?: RefData
): CanvasNodeItem {
  return {
    id: row.id,
    canvasId: row.canvasId,
    type: row.type as CanvasNodeType,
    refId: row.refId,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    color: row.color,
    content: row.content,
    zIndex: row.zIndex,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as number),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as number),
    refTitle: refData?.title,
    refPreview: refData?.preview
  }
}

/** type별 refId를 모아 batch fetch → Map<refId, RefData> */
function batchFetchRefs(
  nodes: ReturnType<typeof canvasNodeRepository.findByCanvasId>
): Map<string, RefData> {
  const refMap = new Map<string, RefData>()

  // type별 refId 수집
  const idsByType: Record<string, string[]> = {}
  for (const node of nodes) {
    if (!node.refId || node.type === 'text') continue
    if (!idsByType[node.type]) idsByType[node.type] = []
    idsByType[node.type].push(node.refId)
  }

  // batch fetch per type
  if (idsByType.todo?.length) {
    for (const t of todoRepository.findByIds(idsByType.todo)) {
      refMap.set(t.id, { title: t.title, preview: (t.description ?? '').slice(0, 200) })
    }
  }
  if (idsByType.note?.length) {
    for (const n of noteRepository.findByIds(idsByType.note)) {
      refMap.set(n.id, { title: n.title, preview: (n.preview ?? '').slice(0, 200) })
    }
  }
  if (idsByType.schedule?.length) {
    for (const s of scheduleRepository.findByIds(idsByType.schedule)) {
      refMap.set(s.id, { title: s.title, preview: s.description ?? s.location ?? '' })
    }
  }
  if (idsByType.csv?.length) {
    for (const c of csvFileRepository.findByIds(idsByType.csv)) {
      refMap.set(c.id, { title: c.title, preview: c.preview ?? '' })
    }
  }
  if (idsByType.pdf?.length) {
    for (const p of pdfFileRepository.findByIds(idsByType.pdf)) {
      refMap.set(p.id, { title: p.title, preview: p.preview ?? '' })
    }
  }
  if (idsByType.image?.length) {
    for (const img of imageFileRepository.findByIds(idsByType.image)) {
      refMap.set(img.id, { title: img.title, preview: img.description ?? '' })
    }
  }

  return refMap
}

export const canvasNodeService = {
  findByCanvas(canvasId: string): CanvasNodeItem[] {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    const nodes = canvasNodeRepository.findByCanvasId(canvasId)
    const refMap = batchFetchRefs(nodes)
    return nodes.map((n) => toCanvasNodeItem(n, n.refId ? refMap.get(n.refId) : undefined))
  },

  /** ref 데이터만 다시 fetch (탭 활성화 시 부분 갱신용) */
  fetchRefData(canvasId: string): Map<string, RefData> {
    const nodes = canvasNodeRepository.findByCanvasId(canvasId)
    return batchFetchRefs(nodes)
  },

  create(canvasId: string, data: CreateCanvasNodeData): CanvasNodeItem {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    const now = new Date()
    const row = canvasNodeRepository.create({
      id: nanoid(),
      canvasId,
      type: data.type,
      refId: data.refId ?? null,
      x: data.x,
      y: data.y,
      width: data.width ?? 260,
      height: data.height ?? 160,
      color: data.color ?? null,
      content: data.content ?? null,
      zIndex: 0,
      createdAt: now,
      updatedAt: now
    })
    return toCanvasNodeItem(row)
  },

  update(nodeId: string, data: UpdateCanvasNodeData): CanvasNodeItem {
    const node = canvasNodeRepository.findById(nodeId)
    if (!node) throw new NotFoundError(`Canvas node not found: ${nodeId}`)
    const updated = canvasNodeRepository.update(nodeId, {
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.width !== undefined ? { width: data.width } : {}),
      ...(data.height !== undefined ? { height: data.height } : {}),
      ...(data.zIndex !== undefined ? { zIndex: data.zIndex } : {}),
      updatedAt: new Date()
    })
    if (!updated) throw new NotFoundError(`Canvas node not found: ${nodeId}`)
    return toCanvasNodeItem(updated)
  },

  updatePositions(updates: { id: string; x: number; y: number }[]): void {
    canvasNodeRepository.bulkUpdatePositions(updates)
  },

  remove(nodeId: string): void {
    const node = canvasNodeRepository.findById(nodeId)
    if (!node) throw new NotFoundError(`Canvas node not found: ${nodeId}`)
    canvasNodeRepository.delete(nodeId)
    // FK CASCADE가 연결 엣지 자동 삭제
  }
}
```

### 3.3 `src/main/services/canvas-edge.ts` (신규)

```typescript
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { canvasEdgeRepository } from '../repositories/canvas-edge'
import { canvasRepository } from '../repositories/canvas'
import { canvasNodeRepository } from '../repositories/canvas-node'

export type CanvasEdgeSide = 'top' | 'right' | 'bottom' | 'left'
export type CanvasEdgeStyle = 'solid' | 'dashed' | 'dotted'
export type CanvasEdgeArrow = 'none' | 'end' | 'both'

export interface CanvasEdgeItem {
  id: string
  canvasId: string
  fromNode: string
  toNode: string
  fromSide: CanvasEdgeSide
  toSide: CanvasEdgeSide
  label: string | null
  color: string | null
  style: CanvasEdgeStyle
  arrow: CanvasEdgeArrow
  createdAt: Date
}

export interface CreateCanvasEdgeData {
  fromNode: string
  toNode: string
  fromSide?: CanvasEdgeSide
  toSide?: CanvasEdgeSide
  label?: string
  color?: string
  style?: CanvasEdgeStyle
  arrow?: CanvasEdgeArrow
}

export interface UpdateCanvasEdgeData {
  fromSide?: CanvasEdgeSide
  toSide?: CanvasEdgeSide
  label?: string
  color?: string
  style?: CanvasEdgeStyle
  arrow?: CanvasEdgeArrow
}

function toCanvasEdgeItem(
  row: NonNullable<ReturnType<typeof canvasEdgeRepository.findById>>
): CanvasEdgeItem {
  return {
    id: row.id,
    canvasId: row.canvasId,
    fromNode: row.fromNode,
    toNode: row.toNode,
    fromSide: row.fromSide,
    toSide: row.toSide,
    label: row.label,
    color: row.color,
    style: row.style,
    arrow: row.arrow,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as number)
  }
}

export const canvasEdgeService = {
  findByCanvas(canvasId: string): CanvasEdgeItem[] {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)
    return canvasEdgeRepository.findByCanvasId(canvasId).map(toCanvasEdgeItem)
  },

  create(canvasId: string, data: CreateCanvasEdgeData): CanvasEdgeItem {
    const canvas = canvasRepository.findById(canvasId)
    if (!canvas) throw new NotFoundError(`Canvas not found: ${canvasId}`)

    // Self-loop 불가
    if (data.fromNode === data.toNode) {
      throw new ValidationError('Cannot create self-loop edge')
    }

    // from/to 노드 존재 확인
    const fromNode = canvasNodeRepository.findById(data.fromNode)
    if (!fromNode) throw new NotFoundError(`From node not found: ${data.fromNode}`)
    const toNode = canvasNodeRepository.findById(data.toNode)
    if (!toNode) throw new NotFoundError(`To node not found: ${data.toNode}`)

    // 같은 방향 중복 엣지 불가
    const existing = canvasEdgeRepository.findByCanvasId(canvasId)
    const duplicate = existing.some((e) => e.fromNode === data.fromNode && e.toNode === data.toNode)
    if (duplicate) {
      throw new ValidationError('Duplicate edge already exists')
    }

    const row = canvasEdgeRepository.create({
      id: nanoid(),
      canvasId,
      fromNode: data.fromNode,
      toNode: data.toNode,
      fromSide: data.fromSide ?? 'right',
      toSide: data.toSide ?? 'left',
      label: data.label ?? null,
      color: data.color ?? null,
      style: data.style ?? 'solid',
      arrow: data.arrow ?? 'end',
      createdAt: new Date()
    })
    return toCanvasEdgeItem(row)
  },

  update(edgeId: string, data: UpdateCanvasEdgeData): CanvasEdgeItem {
    const edge = canvasEdgeRepository.findById(edgeId)
    if (!edge) throw new NotFoundError(`Canvas edge not found: ${edgeId}`)
    const updated = canvasEdgeRepository.update(edgeId, {
      ...(data.fromSide !== undefined ? { fromSide: data.fromSide } : {}),
      ...(data.toSide !== undefined ? { toSide: data.toSide } : {}),
      ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.style !== undefined ? { style: data.style } : {}),
      ...(data.arrow !== undefined ? { arrow: data.arrow } : {})
    })
    if (!updated) throw new NotFoundError(`Canvas edge not found: ${edgeId}`)
    return toCanvasEdgeItem(updated)
  },

  remove(edgeId: string): void {
    const edge = canvasEdgeRepository.findById(edgeId)
    if (!edge) throw new NotFoundError(`Canvas edge not found: ${edgeId}`)
    canvasEdgeRepository.delete(edgeId)
  }
}
```

---

## 4. IPC Handlers

### 4.1 `src/main/ipc/canvas.ts` (신규)

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { canvasService } from '../services/canvas'

export function registerCanvasHandlers(): void {
  ipcMain.handle(
    'canvas:findByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => canvasService.findByWorkspace(workspaceId))
  )

  ipcMain.handle(
    'canvas:findById',
    (_: IpcMainInvokeEvent, canvasId: string): IpcResponse =>
      handle(() => canvasService.findById(canvasId))
  )

  ipcMain.handle(
    'canvas:create',
    (_: IpcMainInvokeEvent, workspaceId: string, data: unknown): IpcResponse =>
      handle(() =>
        canvasService.create(workspaceId, data as { title: string; description?: string })
      )
  )

  ipcMain.handle(
    'canvas:update',
    (_: IpcMainInvokeEvent, canvasId: string, data: unknown): IpcResponse =>
      handle(() => canvasService.update(canvasId, data as { title?: string; description?: string }))
  )

  ipcMain.handle(
    'canvas:updateViewport',
    (_: IpcMainInvokeEvent, canvasId: string, viewport: unknown): IpcResponse =>
      handle(() =>
        canvasService.updateViewport(canvasId, viewport as { x: number; y: number; zoom: number })
      )
  )

  ipcMain.handle(
    'canvas:remove',
    (_: IpcMainInvokeEvent, canvasId: string): IpcResponse =>
      handle(() => canvasService.remove(canvasId))
  )
}
```

### 4.2 `src/main/ipc/canvas-node.ts` (신규)

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { canvasNodeService } from '../services/canvas-node'
import type { CreateCanvasNodeData, UpdateCanvasNodeData } from '../services/canvas-node'

export function registerCanvasNodeHandlers(): void {
  ipcMain.handle(
    'canvasNode:findByCanvas',
    (_: IpcMainInvokeEvent, canvasId: string): IpcResponse =>
      handle(() => canvasNodeService.findByCanvas(canvasId))
  )

  ipcMain.handle(
    'canvasNode:create',
    (_: IpcMainInvokeEvent, canvasId: string, data: unknown): IpcResponse =>
      handle(() => canvasNodeService.create(canvasId, data as CreateCanvasNodeData))
  )

  ipcMain.handle(
    'canvasNode:update',
    (_: IpcMainInvokeEvent, nodeId: string, data: unknown): IpcResponse =>
      handle(() => canvasNodeService.update(nodeId, data as UpdateCanvasNodeData))
  )

  ipcMain.handle(
    'canvasNode:updatePositions',
    (_: IpcMainInvokeEvent, updates: unknown): IpcResponse =>
      handle(() =>
        canvasNodeService.updatePositions(updates as { id: string; x: number; y: number }[])
      )
  )

  ipcMain.handle(
    'canvasNode:remove',
    (_: IpcMainInvokeEvent, nodeId: string): IpcResponse =>
      handle(() => canvasNodeService.remove(nodeId))
  )
}
```

### 4.3 `src/main/ipc/canvas-edge.ts` (신규)

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { canvasEdgeService } from '../services/canvas-edge'
import type { CreateCanvasEdgeData, UpdateCanvasEdgeData } from '../services/canvas-edge'

export function registerCanvasEdgeHandlers(): void {
  ipcMain.handle(
    'canvasEdge:findByCanvas',
    (_: IpcMainInvokeEvent, canvasId: string): IpcResponse =>
      handle(() => canvasEdgeService.findByCanvas(canvasId))
  )

  ipcMain.handle(
    'canvasEdge:create',
    (_: IpcMainInvokeEvent, canvasId: string, data: unknown): IpcResponse =>
      handle(() => canvasEdgeService.create(canvasId, data as CreateCanvasEdgeData))
  )

  ipcMain.handle(
    'canvasEdge:update',
    (_: IpcMainInvokeEvent, edgeId: string, data: unknown): IpcResponse =>
      handle(() => canvasEdgeService.update(edgeId, data as UpdateCanvasEdgeData))
  )

  ipcMain.handle(
    'canvasEdge:remove',
    (_: IpcMainInvokeEvent, edgeId: string): IpcResponse =>
      handle(() => canvasEdgeService.remove(edgeId))
  )
}
```

### 4.4 `src/main/index.ts` 수정

```typescript
// app.whenReady() 내부에 추가
import { registerCanvasHandlers } from './ipc/canvas'
import { registerCanvasNodeHandlers } from './ipc/canvas-node'
import { registerCanvasEdgeHandlers } from './ipc/canvas-edge'

// 기존 12개 register 호출 뒤에 추가
registerCanvasHandlers()
registerCanvasNodeHandlers()
registerCanvasEdgeHandlers()
```

---

## 5. Preload Bridge

### 5.1 `src/preload/index.d.ts` 수정 — 타입 추가

```typescript
// ── Canvas 데이터 타입 ──

interface CanvasItem {
  id: string
  workspaceId: string
  title: string
  description: string
  viewportX: number
  viewportY: number
  viewportZoom: number
  createdAt: Date
  updatedAt: Date
}

interface CanvasNodeItem {
  id: string
  canvasId: string
  type: 'text' | 'todo' | 'note' | 'schedule' | 'csv' | 'pdf' | 'image'
  refId: string | null
  x: number
  y: number
  width: number
  height: number
  color: string | null
  content: string | null
  zIndex: number
  createdAt: Date
  updatedAt: Date
  refTitle?: string
  refPreview?: string
}

interface CanvasEdgeItem {
  id: string
  canvasId: string
  fromNode: string
  toNode: string
  fromSide: 'top' | 'right' | 'bottom' | 'left'
  toSide: 'top' | 'right' | 'bottom' | 'left'
  label: string | null
  color: string | null
  style: 'solid' | 'dashed' | 'dotted'
  arrow: 'none' | 'end' | 'both'
  createdAt: Date
}

interface CreateCanvasNodeData {
  type: CanvasNodeItem['type']
  refId?: string
  x: number
  y: number
  width?: number
  height?: number
  color?: string
  content?: string
}

interface UpdateCanvasNodeData {
  content?: string
  color?: string
  width?: number
  height?: number
  zIndex?: number
}

interface CreateCanvasEdgeData {
  fromNode: string
  toNode: string
  fromSide?: 'top' | 'right' | 'bottom' | 'left'
  toSide?: 'top' | 'right' | 'bottom' | 'left'
  label?: string
  color?: string
  style?: 'solid' | 'dashed' | 'dotted'
  arrow?: 'none' | 'end' | 'both'
}

interface UpdateCanvasEdgeData {
  fromSide?: 'top' | 'right' | 'bottom' | 'left'
  toSide?: 'top' | 'right' | 'bottom' | 'left'
  label?: string
  color?: string
  style?: 'solid' | 'dashed' | 'dotted'
  arrow?: 'none' | 'end' | 'both'
}

// ── Canvas API 인터페이스 ──

interface CanvasAPI {
  findByWorkspace: (workspaceId: string) => Promise<IpcResponse<CanvasItem[]>>
  findById: (canvasId: string) => Promise<IpcResponse<CanvasItem>>
  create: (
    workspaceId: string,
    data: { title: string; description?: string }
  ) => Promise<IpcResponse<CanvasItem>>
  update: (
    canvasId: string,
    data: { title?: string; description?: string }
  ) => Promise<IpcResponse<CanvasItem>>
  updateViewport: (
    canvasId: string,
    viewport: { x: number; y: number; zoom: number }
  ) => Promise<IpcResponse<void>>
  remove: (canvasId: string) => Promise<IpcResponse<void>>
}

interface CanvasNodeAPI {
  findByCanvas: (canvasId: string) => Promise<IpcResponse<CanvasNodeItem[]>>
  create: (canvasId: string, data: CreateCanvasNodeData) => Promise<IpcResponse<CanvasNodeItem>>
  update: (nodeId: string, data: UpdateCanvasNodeData) => Promise<IpcResponse<CanvasNodeItem>>
  updatePositions: (updates: { id: string; x: number; y: number }[]) => Promise<IpcResponse<void>>
  remove: (nodeId: string) => Promise<IpcResponse<void>>
}

interface CanvasEdgeAPI {
  findByCanvas: (canvasId: string) => Promise<IpcResponse<CanvasEdgeItem[]>>
  create: (canvasId: string, data: CreateCanvasEdgeData) => Promise<IpcResponse<CanvasEdgeItem>>
  update: (edgeId: string, data: UpdateCanvasEdgeData) => Promise<IpcResponse<CanvasEdgeItem>>
  remove: (edgeId: string) => Promise<IpcResponse<void>>
}

// ── API 인터페이스 확장 ──
interface API {
  // ... 기존 12개
  canvas: CanvasAPI
  canvasNode: CanvasNodeAPI
  canvasEdge: CanvasEdgeAPI
}
```

### 5.2 `src/preload/index.ts` 수정 — 구현 추가

```typescript
// api 객체 내부에 추가
canvas: {
  findByWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke('canvas:findByWorkspace', workspaceId),
  findById: (canvasId: string) =>
    ipcRenderer.invoke('canvas:findById', canvasId),
  create: (workspaceId: string, data: unknown) =>
    ipcRenderer.invoke('canvas:create', workspaceId, data),
  update: (canvasId: string, data: unknown) =>
    ipcRenderer.invoke('canvas:update', canvasId, data),
  updateViewport: (canvasId: string, viewport: unknown) =>
    ipcRenderer.invoke('canvas:updateViewport', canvasId, viewport),
  remove: (canvasId: string) =>
    ipcRenderer.invoke('canvas:remove', canvasId),
},
canvasNode: {
  findByCanvas: (canvasId: string) =>
    ipcRenderer.invoke('canvasNode:findByCanvas', canvasId),
  create: (canvasId: string, data: unknown) =>
    ipcRenderer.invoke('canvasNode:create', canvasId, data),
  update: (nodeId: string, data: unknown) =>
    ipcRenderer.invoke('canvasNode:update', nodeId, data),
  updatePositions: (updates: unknown) =>
    ipcRenderer.invoke('canvasNode:updatePositions', updates),
  remove: (nodeId: string) =>
    ipcRenderer.invoke('canvasNode:remove', nodeId),
},
canvasEdge: {
  findByCanvas: (canvasId: string) =>
    ipcRenderer.invoke('canvasEdge:findByCanvas', canvasId),
  create: (canvasId: string, data: unknown) =>
    ipcRenderer.invoke('canvasEdge:create', canvasId, data),
  update: (edgeId: string, data: unknown) =>
    ipcRenderer.invoke('canvasEdge:update', edgeId, data),
  remove: (edgeId: string) =>
    ipcRenderer.invoke('canvasEdge:remove', edgeId),
},
```

---

## 6. 탭 시스템 등록

### 6.1 `src/renderer/src/shared/constants/tab-url.ts` 수정

```typescript
import { Workflow } from 'lucide-react' // 추가

// TabType 확장
export type TabType =
  | 'dashboard'
  | 'todo'
  | 'todo-detail'
  | 'folder'
  | 'note'
  | 'csv'
  | 'pdf'
  | 'image'
  | 'calendar'
  | 'canvas'
  | 'canvas-detail' // 추가

// TAB_ICON 확장
export const TAB_ICON: Record<TabIcon, React.ElementType> = {
  // ...기존 9개
  canvas: Workflow, // 추가
  'canvas-detail': Workflow // 추가
}

// ROUTES 확장
export const ROUTES = {
  // ...기존 10개
  CANVAS: '/canvas', // 추가
  CANVAS_DETAIL: '/canvas/:canvasId' // 추가
} as const

// sidebar_items 확장 (캘린더 다음)
export const sidebar_items: SidebarItem[] = [
  {
    title: '대시보드',
    tabType: 'dashboard',
    pathname: ROUTES.DASHBOARD,
    icon: TAB_ICON['dashboard']
  },
  { title: '할 일', tabType: 'todo', pathname: ROUTES.TODO, icon: TAB_ICON['todo'] },
  { title: '파일 탐색기', tabType: 'folder', pathname: ROUTES.FOLDER, icon: TAB_ICON['folder'] },
  { title: '캘린더', tabType: 'calendar', pathname: ROUTES.CALENDAR, icon: TAB_ICON['calendar'] },
  { title: '캔버스', tabType: 'canvas', pathname: ROUTES.CANVAS, icon: TAB_ICON['canvas'] } // 추가
]
```

### 6.2 `src/renderer/src/app/layout/model/pane-routes.tsx` 수정

```typescript
const CanvasListPage = lazy(() => import('@pages/canvas'))
const CanvasDetailPage = lazy(() => import('@pages/canvas-detail'))

export const PANE_ROUTES: PaneRoute[] = [
  // ...기존 9개
  { pattern: ROUTES.CANVAS, component: CanvasListPage },
  { pattern: ROUTES.CANVAS_DETAIL, component: CanvasDetailPage }
]
```

---

## 7. Entity 레이어

### 7.1 `src/renderer/src/entities/canvas/model/types.ts` (신규)

> 기존 `entities/todo/model/types.ts` 패턴을 따라 타입을 직접 정의한다.
> `preload/index.d.ts` 타입은 ambient global이므로 재사용 가능하나,
> entity 레이어에서 직접 정의하는 것이 FSD 컨벤션이다.

```typescript
export type CanvasNodeType = 'text' | 'todo' | 'note' | 'schedule' | 'csv' | 'pdf' | 'image'
export type CanvasEdgeSide = 'top' | 'right' | 'bottom' | 'left'
export type CanvasEdgeStyle = 'solid' | 'dashed' | 'dotted'
export type CanvasEdgeArrow = 'none' | 'end' | 'both'

export interface CanvasItem {
  id: string
  workspaceId: string
  title: string
  description: string
  viewportX: number
  viewportY: number
  viewportZoom: number
  createdAt: Date
  updatedAt: Date
}

export interface CanvasNodeItem {
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
  createdAt: Date
  updatedAt: Date
  refTitle?: string
  refPreview?: string
}

export interface CanvasEdgeItem {
  id: string
  canvasId: string
  fromNode: string
  toNode: string
  fromSide: CanvasEdgeSide
  toSide: CanvasEdgeSide
  label: string | null
  color: string | null
  style: CanvasEdgeStyle
  arrow: CanvasEdgeArrow
  createdAt: Date
}

export interface CreateCanvasNodeData {
  type: CanvasNodeType
  refId?: string
  x: number
  y: number
  width?: number
  height?: number
  color?: string
  content?: string
}

export interface UpdateCanvasNodeData {
  content?: string
  color?: string
  width?: number
  height?: number
  zIndex?: number
}

export interface CreateCanvasEdgeData {
  fromNode: string
  toNode: string
  fromSide?: CanvasEdgeSide
  toSide?: CanvasEdgeSide
  label?: string
  color?: string
  style?: CanvasEdgeStyle
  arrow?: CanvasEdgeArrow
}

export interface UpdateCanvasEdgeData {
  fromSide?: CanvasEdgeSide
  toSide?: CanvasEdgeSide
  label?: string
  color?: string
  style?: CanvasEdgeStyle
  arrow?: CanvasEdgeArrow
}
```

### 7.2 `src/renderer/src/entities/canvas/model/queries.ts` (신규)

```typescript
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type {
  CanvasItem,
  CanvasNodeItem,
  CanvasEdgeItem,
  CreateCanvasNodeData,
  UpdateCanvasNodeData,
  CreateCanvasEdgeData,
  UpdateCanvasEdgeData
} from './types'

const CANVAS_KEY = 'canvas'
const CANVAS_NODE_KEY = 'canvasNode'
const CANVAS_EDGE_KEY = 'canvasEdge'

// ── Canvas CRUD ──

export function useCanvasById(canvasId: string | null | undefined): UseQueryResult<CanvasItem> {
  return useQuery({
    queryKey: [CANVAS_KEY, canvasId],
    queryFn: async () => {
      const res: IpcResponse<CanvasItem> = await window.api.canvas.findById(canvasId!)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    enabled: !!canvasId
  })
}

export function useCanvasesByWorkspace(
  workspaceId: string | null | undefined
): UseQueryResult<CanvasItem[]> {
  return useQuery({
    queryKey: [CANVAS_KEY, 'workspace', workspaceId],
    queryFn: async () => {
      const res: IpcResponse<CanvasItem[]> = await window.api.canvas.findByWorkspace(workspaceId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useCreateCanvas(): UseMutationResult<
  CanvasItem | undefined,
  Error,
  { workspaceId: string; data: { title: string; description?: string } }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, data }) => {
      const res: IpcResponse<CanvasItem> = await window.api.canvas.create(workspaceId, data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      qc.invalidateQueries({ queryKey: [CANVAS_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useUpdateCanvas(): UseMutationResult<
  CanvasItem | undefined,
  Error,
  { workspaceId: string; canvasId: string; data: { title?: string; description?: string } }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ canvasId, data }) => {
      const res: IpcResponse<CanvasItem> = await window.api.canvas.update(canvasId, data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      qc.invalidateQueries({ queryKey: [CANVAS_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRemoveCanvas(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; canvasId: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ canvasId }) => {
      const res: IpcResponse<void> = await window.api.canvas.remove(canvasId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      qc.invalidateQueries({ queryKey: [CANVAS_KEY, 'workspace', workspaceId] })
    }
  })
}

// ── Canvas Node CRUD ──

export function useCanvasNodes(
  canvasId: string | null | undefined
): UseQueryResult<CanvasNodeItem[]> {
  return useQuery({
    queryKey: [CANVAS_NODE_KEY, 'canvas', canvasId],
    queryFn: async () => {
      const res: IpcResponse<CanvasNodeItem[]> = await window.api.canvasNode.findByCanvas(canvasId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!canvasId
  })
}

export function useCreateNode(): UseMutationResult<
  CanvasNodeItem | undefined,
  Error,
  { canvasId: string; data: CreateCanvasNodeData }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ canvasId, data }) => {
      const res: IpcResponse<CanvasNodeItem> = await window.api.canvasNode.create(canvasId, data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { canvasId }) => {
      qc.invalidateQueries({ queryKey: [CANVAS_NODE_KEY, 'canvas', canvasId] })
    }
  })
}

export function useUpdateNode(): UseMutationResult<
  CanvasNodeItem | undefined,
  Error,
  { canvasId: string; nodeId: string; data: UpdateCanvasNodeData }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ nodeId, data }) => {
      const res: IpcResponse<CanvasNodeItem> = await window.api.canvasNode.update(nodeId, data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { canvasId }) => {
      qc.invalidateQueries({ queryKey: [CANVAS_NODE_KEY, 'canvas', canvasId] })
    }
  })
}

export function useUpdateNodePositions(): UseMutationResult<
  void,
  Error,
  { canvasId: string; updates: { id: string; x: number; y: number }[] }
> {
  // 위치 업데이트는 빈번 → invalidate 불필요 (Zustand store가 진실)
  return useMutation({
    mutationFn: async ({ updates }) => {
      const res: IpcResponse<void> = await window.api.canvasNode.updatePositions(updates)
      if (!res.success) throwIpcError(res)
    }
  })
}

export function useRemoveNode(): UseMutationResult<
  void,
  Error,
  { canvasId: string; nodeId: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ nodeId }) => {
      const res: IpcResponse<void> = await window.api.canvasNode.remove(nodeId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { canvasId }) => {
      qc.invalidateQueries({ queryKey: [CANVAS_NODE_KEY, 'canvas', canvasId] })
    }
  })
}

// ── Canvas Edge CRUD ──

export function useCanvasEdges(
  canvasId: string | null | undefined
): UseQueryResult<CanvasEdgeItem[]> {
  return useQuery({
    queryKey: [CANVAS_EDGE_KEY, 'canvas', canvasId],
    queryFn: async () => {
      const res: IpcResponse<CanvasEdgeItem[]> = await window.api.canvasEdge.findByCanvas(canvasId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!canvasId
  })
}

export function useCreateEdge(): UseMutationResult<
  CanvasEdgeItem | undefined,
  Error,
  { canvasId: string; data: CreateCanvasEdgeData }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ canvasId, data }) => {
      const res: IpcResponse<CanvasEdgeItem> = await window.api.canvasEdge.create(canvasId, data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { canvasId }) => {
      qc.invalidateQueries({ queryKey: [CANVAS_EDGE_KEY, 'canvas', canvasId] })
    }
  })
}

export function useUpdateEdge(): UseMutationResult<
  CanvasEdgeItem | undefined,
  Error,
  { canvasId: string; edgeId: string; data: UpdateCanvasEdgeData }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ edgeId, data }) => {
      const res: IpcResponse<CanvasEdgeItem> = await window.api.canvasEdge.update(edgeId, data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { canvasId }) => {
      qc.invalidateQueries({ queryKey: [CANVAS_EDGE_KEY, 'canvas', canvasId] })
    }
  })
}

export function useRemoveEdge(): UseMutationResult<
  void,
  Error,
  { canvasId: string; edgeId: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ edgeId }) => {
      const res: IpcResponse<void> = await window.api.canvasEdge.remove(edgeId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { canvasId }) => {
      qc.invalidateQueries({ queryKey: [CANVAS_EDGE_KEY, 'canvas', canvasId] })
    }
  })
}
```

### 7.3 `src/renderer/src/entities/canvas/model/converters.ts` (신규)

```typescript
import { type Node, type Edge, MarkerType } from '@xyflow/react'
import type { CanvasNodeItem, CanvasEdgeItem, CreateCanvasEdgeData } from './types'

/** DB CanvasNodeItem → React Flow Node */
export function toReactFlowNode(item: CanvasNodeItem): Node {
  return {
    id: item.id,
    type: item.type,
    position: { x: item.x, y: item.y },
    data: {
      content: item.content,
      color: item.color,
      refId: item.refId,
      refTitle: item.refTitle,
      refPreview: item.refPreview
    },
    style: { width: item.width, height: item.height },
    zIndex: item.zIndex
  }
}

/** DB CanvasEdgeItem → React Flow Edge */
export function toReactFlowEdge(item: CanvasEdgeItem): Edge {
  const edgeColor = item.color || '#666'
  return {
    id: item.id,
    source: item.fromNode,
    target: item.toNode,
    sourceHandle: item.fromSide,
    targetHandle: item.toSide,
    type: 'custom',
    markerEnd:
      item.arrow !== 'none' ? { type: MarkerType.ArrowClosed, color: edgeColor } : undefined,
    markerStart:
      item.arrow === 'both' ? { type: MarkerType.ArrowClosed, color: edgeColor } : undefined,
    data: {
      label: item.label,
      color: item.color,
      style: item.style,
      arrow: item.arrow
    }
  }
}

/** React Flow Node → DB 위치 업데이트 */
export function toPositionUpdate(node: Node): { id: string; x: number; y: number } {
  return { id: node.id, x: node.position.x, y: node.position.y }
}

/** React Flow Connection → DB 엣지 생성 데이터 */
export function toCreateCanvasEdgeData(connection: {
  source: string | null
  target: string | null
  sourceHandle: string | null
  targetHandle: string | null
}): CreateCanvasEdgeData | null {
  if (!connection.source || !connection.target) return null
  return {
    fromNode: connection.source,
    toNode: connection.target,
    fromSide: (connection.sourceHandle as CreateCanvasEdgeData['fromSide']) ?? 'right',
    toSide: (connection.targetHandle as CreateCanvasEdgeData['toSide']) ?? 'left'
  }
}
```

### 7.4 `src/renderer/src/entities/canvas/index.ts` (신규)

```typescript
export type {
  CanvasItem,
  CanvasNodeItem,
  CanvasEdgeItem,
  CanvasNodeType,
  CanvasEdgeSide,
  CanvasEdgeStyle,
  CanvasEdgeArrow,
  CreateCanvasNodeData,
  UpdateCanvasNodeData,
  CreateCanvasEdgeData,
  UpdateCanvasEdgeData
} from './model/types'
export {
  useCanvasById,
  useCanvasesByWorkspace,
  useCreateCanvas,
  useUpdateCanvas,
  useRemoveCanvas,
  useCanvasNodes,
  useCreateNode,
  useUpdateNode,
  useUpdateNodePositions,
  useRemoveNode,
  useCanvasEdges,
  useCreateEdge,
  useUpdateEdge,
  useRemoveEdge
} from './model/queries'
export {
  toReactFlowNode,
  toReactFlowEdge,
  toPositionUpdate,
  toCreateCanvasEdgeData
} from './model/converters'
```

---

## 8. 캔버스 위젯

### 8.1 디렉토리 구조 `src/renderer/src/widgets/canvas-board/`

```
widgets/canvas-board/
├── ui/
│   ├── CanvasBoard.tsx          — ReactFlowProvider 외부 셸 + CanvasBoardInner
│   ├── TextNodeContent.tsx      — text 커스텀 노드 (Handle 4방향 + textarea)
│   ├── RefNodeContent.tsx       — ref 커스텀 노드 (todo/note/schedule/csv/pdf/image 미리보기)
│   ├── CustomEdge.tsx           — 커스텀 엣지 (색상, 스타일, 라벨)
│   └── CanvasToolbar.tsx        — 노드 추가 도구 모음
├── model/
│   ├── canvas-store.ts          — Zustand store (React Flow controlled mode)
│   ├── use-canvas-data.ts       — React Query hydrate + mutation 핸들러
│   ├── use-canvas-flush.ts      — dirtyNodeIds → IPC bulk update
│   └── types.ts                 — TextNodeData, RefNodeData 등
└── index.ts                     — barrel export
```

### 8.2 `model/types.ts`

```typescript
import type { Node } from '@xyflow/react'

export type TextNodeData = {
  content?: string | null
  color?: string | null
}
export type TextNode = Node<TextNodeData, 'text'>

export type RefNodeData = {
  refId?: string | null
  refTitle?: string
  refPreview?: string
  color?: string | null
}
export type RefNode = Node<RefNodeData, 'todo' | 'note' | 'schedule' | 'csv' | 'pdf' | 'image'>
```

### 8.3 `model/canvas-store.ts`

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges
} from '@xyflow/react'

interface CanvasStoreState {
  nodes: Node[]
  edges: Edge[]
  dirtyNodeIds: Set<string>
}

interface CanvasStoreActions {
  hydrate: (nodes: Node[], edges: Edge[]) => void
  reset: () => void

  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange

  addNode: (node: Node) => void
  removeNodes: (nodeIds: string[]) => void
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void

  insertEdge: (edge: Edge) => void
  removeEdges: (edgeIds: string[]) => void

  updateRefData: (refMap: Map<string, { title: string; preview: string }>) => void

  getDirtyPositions: () => { id: string; x: number; y: number }[]
  clearDirty: () => void
}

type CanvasStore = CanvasStoreState & CanvasStoreActions

const createInitialState = (): CanvasStoreState => ({
  nodes: [],
  edges: [],
  dirtyNodeIds: new Set()
})

export const useCanvasStore = create<CanvasStore>()(
  devtools(
    (set, get) => ({
      ...createInitialState(),

      hydrate: (nodes, edges) => set({ nodes, edges, dirtyNodeIds: new Set() }),
      reset: () => set(createInitialState()),

      onNodesChange: (changes) => {
        let newDirtyIds: Set<string> | null = null
        for (const change of changes) {
          if (change.type === 'position' && change.dragging === false && change.position) {
            if (!newDirtyIds) newDirtyIds = new Set(get().dirtyNodeIds)
            newDirtyIds.add(change.id)
          }
        }
        set({
          nodes: applyNodeChanges(changes, get().nodes),
          ...(newDirtyIds ? { dirtyNodeIds: newDirtyIds } : {})
        })
      },

      onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) })
      },

      addNode: (node) => set({ nodes: [...get().nodes, node] }),

      removeNodes: (nodeIds) => {
        const idSet = new Set(nodeIds)
        set({
          nodes: get().nodes.filter((n) => !idSet.has(n.id)),
          edges: get().edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target))
        })
      },

      updateNodeData: (nodeId, data) => {
        set({
          nodes: get().nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
          )
        })
      },

      insertEdge: (edge) => set({ edges: [...get().edges, edge] }),

      removeEdges: (edgeIds) => {
        const idSet = new Set(edgeIds)
        set({ edges: get().edges.filter((e) => !idSet.has(e.id)) })
      },

      updateRefData: (refMap) => {
        set({
          nodes: get().nodes.map((n) => {
            const refId = n.data?.refId as string | undefined
            if (!refId) return n
            const ref = refMap.get(refId)
            if (!ref) return n
            return {
              ...n,
              data: { ...n.data, refTitle: ref.title, refPreview: ref.preview }
            }
          })
        })
      },

      getDirtyPositions: () => {
        const { nodes, dirtyNodeIds } = get()
        return nodes
          .filter((n) => dirtyNodeIds.has(n.id))
          .map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }))
      },

      clearDirty: () => set({ dirtyNodeIds: new Set() })
    }),
    { name: 'canvas-store' }
  )
)
```

### 8.4 `model/use-canvas-data.ts`

```typescript
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useCanvasById,
  useCanvasNodes,
  useCanvasEdges,
  useCreateNode,
  useRemoveNode,
  useCreateEdge,
  useRemoveEdge
} from '@entities/canvas'
import { toReactFlowNode, toReactFlowEdge, toCreateCanvasEdgeData } from '@entities/canvas'
import { useCanvasStore } from './canvas-store'
import type { Connection, Node, Edge } from '@xyflow/react'

interface UseCanvasDataReturn {
  /** React Query 로딩 또는 store hydration 미완 → true */
  isReady: boolean
  savedViewport: { x: number; y: number; zoom: number } | undefined
  handleConnect: (connection: Connection) => void
  handleNodesDelete: (nodes: Node[]) => void
  handleEdgesDelete: (edges: Edge[]) => void
  handleAddTextNode: (position: { x: number; y: number }) => void
  saveViewport: (canvasId: string, viewport: { x: number; y: number; zoom: number }) => void
}

export function useCanvasData(canvasId: string): UseCanvasDataReturn {
  // ── Canvas 메타데이터 (viewport 복원용) ──
  const { data: canvasData, isLoading: canvasLoading } = useCanvasById(canvasId)

  // ── Nodes & Edges ──
  const { data: nodesData, isLoading: nodesLoading } = useCanvasNodes(canvasId)
  const { data: edgesData, isLoading: edgesLoading } = useCanvasEdges(canvasId)
  const isLoading = canvasLoading || nodesLoading || edgesLoading

  // ── Hydration state (state로 관리하여 ReactFlow 마운트 게이트) ──
  const [hydrated, setHydrated] = useState(false)

  // savedViewport: canvas 메타에서 추출
  const savedViewport = canvasData
    ? { x: canvasData.viewportX, y: canvasData.viewportY, zoom: canvasData.viewportZoom }
    : undefined

  // Hydrate: React Query 결과 → Zustand store (한 번만)
  const hydrationDone = useRef(false)
  useEffect(() => {
    if (!nodesData || !edgesData || hydrationDone.current) return
    const rfNodes = nodesData.map(toReactFlowNode)
    const rfEdges = edgesData.map(toReactFlowEdge)
    useCanvasStore.getState().hydrate(rfNodes, rfEdges)
    hydrationDone.current = true
    setHydrated(true)
  }, [nodesData, edgesData])

  // Cleanup on canvasId change / unmount
  useEffect(() => {
    return () => {
      hydrationDone.current = false
      setHydrated(false)
      useCanvasStore.getState().reset()
    }
  }, [canvasId])

  // isReady: 로딩 완료 + hydration 완료 → ReactFlow 마운트 허용
  const isReady = !isLoading && hydrated

  // ── Mutations (mutate만 추출 — stable reference) ──
  const { mutate: createNode } = useCreateNode()
  const { mutate: removeNode } = useRemoveNode()
  const { mutate: createEdge } = useCreateEdge()
  const { mutate: removeEdge } = useRemoveEdge()

  // ── Viewport 저장 (안정 참조) ──
  const saveViewport = useCallback(
    (cid: string, viewport: { x: number; y: number; zoom: number }) => {
      window.api.canvas.updateViewport(cid, viewport)
    },
    []
  )

  // ── 노드 추가 (C-1 fix: onSuccess에서 store 갱신) ──
  const handleAddTextNode = useCallback(
    (position: { x: number; y: number }) => {
      createNode(
        { canvasId, data: { type: 'text', x: position.x, y: position.y } },
        {
          onSuccess: (nodeItem) => {
            if (nodeItem) {
              useCanvasStore.getState().addNode(toReactFlowNode(nodeItem))
            }
          }
        }
      )
    },
    [canvasId, createNode]
  )

  // ── 엣지 연결 ──
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      if (connection.source === connection.target) return
      const edges = useCanvasStore.getState().edges
      const exists = edges.some(
        (e) => e.source === connection.source && e.target === connection.target
      )
      if (exists) return
      const data = toCreateCanvasEdgeData(connection)
      if (!data) return
      createEdge(
        { canvasId, data },
        {
          onSuccess: (edgeItem) => {
            if (edgeItem) {
              useCanvasStore.getState().insertEdge(toReactFlowEdge(edgeItem))
            }
          }
        }
      )
    },
    [canvasId, createEdge]
  )

  // ── 노드 삭제 ──
  const handleNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      const deletedIds = new Set(deletedNodes.map((n) => n.id))
      const connectedEdges = useCanvasStore
        .getState()
        .edges.filter((e) => deletedIds.has(e.source) || deletedIds.has(e.target))
      if (connectedEdges.length > 0) {
        useCanvasStore.getState().removeEdges(connectedEdges.map((e) => e.id))
      }
      for (const node of deletedNodes) {
        removeNode({ canvasId, nodeId: node.id })
      }
    },
    [canvasId, removeNode]
  )

  // ── 엣지 삭제 ──
  const handleEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        removeEdge({ canvasId, edgeId: edge.id })
      }
    },
    [canvasId, removeEdge]
  )

  return {
    isReady,
    savedViewport,
    handleConnect,
    handleNodesDelete,
    handleEdgesDelete,
    handleAddTextNode,
    saveViewport
  }
}
```

### 8.5 `model/use-canvas-flush.ts`

```typescript
import { useEffect } from 'react'
import { useCanvasStore } from './canvas-store'
import { useUpdateNodePositions } from '@entities/canvas'

/** dirtyNodeIds 변경 감지 → IPC bulk position update */
export function useCanvasFlush(canvasId: string): void {
  const dirtyNodeIds = useCanvasStore((s) => s.dirtyNodeIds)
  const { mutate: flushPositions } = useUpdateNodePositions()

  useEffect(() => {
    if (dirtyNodeIds.size === 0) return
    const positions = useCanvasStore.getState().getDirtyPositions()
    if (positions.length === 0) return
    flushPositions({ canvasId, updates: positions })
    useCanvasStore.getState().clearDirty()
  }, [dirtyNodeIds, canvasId, flushPositions])
}
```

### 8.6 `ui/CanvasBoard.tsx`

```tsx
import { useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ConnectionMode,
  useReactFlow,
  type Viewport
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useCanvasStore } from '../model/canvas-store'
import { useCanvasData } from '../model/use-canvas-data'
import { useCanvasFlush } from '../model/use-canvas-flush'
import { TextNodeContent } from './TextNodeContent'
import { RefNodeContent } from './RefNodeContent'
import { CustomEdge } from './CustomEdge'
import { CanvasToolbar } from './CanvasToolbar'

// 모듈 레벨에서 정의 (리렌더링 방지)
const nodeTypes = {
  text: TextNodeContent,
  todo: RefNodeContent,
  note: RefNodeContent,
  schedule: RefNodeContent,
  csv: RefNodeContent,
  pdf: RefNodeContent,
  image: RefNodeContent
}

const edgeTypes = {
  custom: CustomEdge
}

interface CanvasBoardProps {
  canvasId: string
}

export function CanvasBoard({ canvasId }: CanvasBoardProps) {
  return (
    <ReactFlowProvider>
      <CanvasBoardInner canvasId={canvasId} />
    </ReactFlowProvider>
  )
}

function CanvasBoardInner({ canvasId }: CanvasBoardProps) {
  // M-2 fix: 개별 selector로 과도 구독 방지
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange)

  const {
    isReady,
    savedViewport,
    handleConnect,
    handleNodesDelete,
    handleEdgesDelete,
    handleAddTextNode,
    saveViewport
  } = useCanvasData(canvasId)
  const { screenToFlowPosition } = useReactFlow()

  // Flush hook
  useCanvasFlush(canvasId)

  // H-6 fix: 배경(pane)에서만 더블클릭 → 새 text 노드
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.classList.contains('react-flow__pane')) return
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })
      handleAddTextNode(position)
    },
    [screenToFlowPosition, handleAddTextNode]
  )

  // H-7 fix: 툴바에서 노드 추가 (캔버스 중앙 위치)
  const handleToolbarAddTextNode = useCallback(() => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    })
    handleAddTextNode(center)
  }, [screenToFlowPosition, handleAddTextNode])

  // M-9 fix: 초기 마운트 직후 viewport 저장 방지
  const viewportSavingEnabled = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      viewportSavingEnabled.current = true
    }, 1000)
    return () => {
      clearTimeout(timer)
      viewportSavingEnabled.current = false
    }
  }, [canvasId])

  // 뷰포트 디바운스 저장
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleViewportSave = useCallback(
    (viewport: Viewport) => {
      if (!viewportSavingEnabled.current) return
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current)
      viewportTimerRef.current = setTimeout(() => {
        saveViewport(canvasId, viewport)
      }, 500)
    },
    [canvasId, saveViewport]
  )
  useEffect(() => {
    return () => {
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current)
    }
  }, [])

  // C-2 fix: isReady = 로딩 + hydration 완료 후에만 ReactFlow 마운트
  if (!isReady) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <CanvasToolbar onAddTextNode={handleToolbarAddTextNode} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'custom' }}
        connectionMode={ConnectionMode.Loose}
        onlyRenderVisibleElements
        snapToGrid
        snapGrid={[20, 20]}
        defaultViewport={savedViewport ?? { x: 0, y: 0, zoom: 1 }}
        fitView={nodes.length === 0 && !savedViewport}
        onMoveEnd={(_, viewport) => handleViewportSave(viewport)}
        onDoubleClick={handleDoubleClick}
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={20} />
      </ReactFlow>
    </div>
  )
}
```

### 8.7 `ui/TextNodeContent.tsx`

```tsx
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@shared/lib/utils'
import type { TextNode } from '../model/types'

export const TextNodeContent = memo(function TextNodeContent({
  data,
  selected
}: NodeProps<TextNode>) {
  return (
    <div
      className={cn('rounded-lg border bg-card p-3 shadow-sm', selected && 'ring-2 ring-primary')}
      style={data.color ? { backgroundColor: data.color } : undefined}
    >
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <div className="min-h-[2rem] text-sm whitespace-pre-wrap">
        {data.content || '더블클릭하여 편집'}
      </div>
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
    </div>
  )
})
```

### 8.8 `ui/RefNodeContent.tsx`

```tsx
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@shared/lib/utils'
import { ENTITY_TYPE_ICON, ENTITY_TYPE_LABEL } from '@shared/lib/entity-link'
import type { RefNode } from '../model/types'

export const RefNodeContent = memo(function RefNodeContent({
  data,
  type: nodeType,
  selected
}: NodeProps<RefNode>) {
  const Icon = ENTITY_TYPE_ICON[nodeType as keyof typeof ENTITY_TYPE_ICON]
  const label = ENTITY_TYPE_LABEL[nodeType as keyof typeof ENTITY_TYPE_LABEL]

  const isBroken = data.refId && !data.refTitle

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm',
        selected && 'ring-2 ring-primary',
        isBroken && 'border-destructive opacity-60'
      )}
      style={data.color ? { backgroundColor: data.color } : undefined}
    >
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {Icon && <Icon className="h-3 w-3" />}
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium truncate">
        {isBroken ? '삭제된 항목' : (data.refTitle ?? '제목 없음')}
      </div>
      {data.refPreview && !isBroken && (
        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{data.refPreview}</div>
      )}
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
    </div>
  )
})
```

### 8.9 `ui/CustomEdge.tsx`

```tsx
import { BaseEdge, getBezierPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react'

export function CustomEdge(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
    markerStart
  } = props

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition
  })

  const edgeColor = (data?.color as string) || '#666'

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: edgeColor,
          strokeDasharray:
            data?.style === 'dashed' ? '6 4' : data?.style === 'dotted' ? '2 4' : undefined
        }}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all'
            }}
            className="nodrag nopan rounded bg-background px-2 py-0.5 text-xs border shadow-sm"
          >
            {data.label as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
```

### 8.10 `ui/CanvasToolbar.tsx`

```tsx
import { Plus } from 'lucide-react'
import { Button } from '@shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'

interface CanvasToolbarProps {
  onAddTextNode: () => void
  // Phase 2: onAddRefNode
}

export function CanvasToolbar({ onAddTextNode }: CanvasToolbarProps) {
  return (
    <div className="absolute top-3 left-3 z-10">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            노드 추가
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onAddTextNode}>텍스트 노드</DropdownMenuItem>
          {/* Phase 2: ref 노드 추가 항목들 */}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
```

### 8.11 `index.ts` (barrel)

```typescript
export { CanvasBoard } from './ui/CanvasBoard'
```

---

## 9. 페이지

### 9.1 `src/renderer/src/pages/canvas/ui/CanvasListPage.tsx` (신규)

```tsx
import { Plus, Workflow, Trash2 } from 'lucide-react'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import {
  useCanvasesByWorkspace,
  useCreateCanvas,
  useRemoveCanvas,
  type CanvasItem
} from '@entities/canvas'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { Button } from '@shared/ui/button'

interface Props {
  tabId?: string
}

export function CanvasListPage({ tabId }: Props) {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const { data: canvases = [] } = useCanvasesByWorkspace(workspaceId)
  const createCanvas = useCreateCanvas()
  const removeCanvas = useRemoveCanvas()
  const openTab = useTabStore((s) => s.openTab)

  const handleCreate = () => {
    if (!workspaceId) return
    createCanvas.mutate(
      { workspaceId, data: { title: '새 캔버스' } },
      {
        onSuccess: (canvas) => {
          if (canvas) {
            openTab({
              type: 'canvas-detail',
              pathname: `/canvas/${canvas.id}`,
              title: canvas.title
            })
          }
        }
      }
    )
  }

  const handleOpen = (canvas: CanvasItem) => {
    openTab({
      type: 'canvas-detail',
      pathname: `/canvas/${canvas.id}`,
      title: canvas.title
    })
  }

  const handleRemove = (canvasId: string) => {
    if (!workspaceId) return
    if (!window.confirm('캔버스를 삭제하시겠습니까? 모든 노드와 엣지가 함께 삭제됩니다.')) return
    removeCanvas.mutate({ workspaceId, canvasId })
  }

  return (
    <TabContainer
      header={
        <TabHeader
          title="캔버스"
          description="캔버스를 관리하는 페이지입니다."
          buttons={
            <Button variant="outline" size="sm" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" />새 캔버스
            </Button>
          }
        />
      }
    >
      {!workspaceId ? (
        <div className="p-4 text-muted-foreground">워크스페이스를 선택해주세요</div>
      ) : canvases.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Workflow className="h-12 w-12 opacity-30" />
          <p>아직 캔버스가 없습니다</p>
          <Button variant="outline" size="sm" onClick={handleCreate}>
            첫 캔버스 만들기
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 @[400px]:grid-cols-2 @[800px]:grid-cols-3 gap-3 p-4">
          {canvases.map((canvas) => (
            <div
              key={canvas.id}
              className="group cursor-pointer rounded-lg border bg-card p-4 hover:border-primary transition-colors"
              onClick={() => handleOpen(canvas)}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium truncate">{canvas.title}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(canvas.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {canvas.description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {canvas.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </TabContainer>
  )
}
```

### 9.2 `src/renderer/src/pages/canvas/index.ts`

```typescript
export { CanvasListPage as default } from './ui/CanvasListPage'
```

### 9.3 `src/renderer/src/pages/canvas-detail/ui/CanvasDetailPage.tsx` (신규)

```tsx
import { CanvasBoard } from '@widgets/canvas-board'

interface Props {
  tabId?: string
  params?: Record<string, string>
}

export function CanvasDetailPage({ params }: Props) {
  const canvasId = params?.canvasId ?? ''

  // M-3 fix: TabContainer 대신 전체 크기 div 사용 (header 빈 패딩 방지)
  return (
    <div className="h-full w-full">
      <CanvasBoard canvasId={canvasId} />
    </div>
  )
}
```

### 9.4 `src/renderer/src/pages/canvas-detail/index.ts`

```typescript
export { CanvasDetailPage as default } from './ui/CanvasDetailPage'
```

---

## 10. Phase 2 설계 (요약)

### 10.1 Entity Link 통합

수정 대상 5개 파일 (Plan Section 13 참조):

| 파일                                                                      | 변경                                                                          |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/main/db/schema/entity-link.ts`                                       | `LinkableEntityType`에 `'canvas'` 추가                                        |
| `src/main/services/entity-link.ts`                                        | `findEntity()` switch에 `case 'canvas': return canvasRepository.findById(id)` |
| `src/preload/index.d.ts`                                                  | `LinkableEntityType` 타입 동기화                                              |
| `src/renderer/src/shared/lib/entity-link.ts`                              | label: `'캔버스'`, icon: `Workflow`                                           |
| `src/renderer/src/features/entity-link/manage-link/lib/to-tab-options.ts` | `case 'canvas'`                                                               |

### 10.2 캔버스 삭제 시 Entity Link 정리

`canvasService.remove()`에 추가:

```typescript
import { entityLinkService } from './entity-link'

// remove() 내부, delete 전에
entityLinkService.removeAllLinks('canvas', canvasId)
canvasRepository.delete(canvasId)
```

### 10.3 ref 노드 추가 다이얼로그

`src/renderer/src/features/canvas/add-ref-node/` — 기존 엔티티 검색/선택 UI + `createNodeMutation`.

### 10.4 그룹 CRUD

`canvas-group.ts` Repository + Service + IPC (canvas-group.ts 패턴은 canvas.ts와 동일).

---

## 11. Phase 3 설계 (요약)

### 11.1 자동 레이아웃

```bash
npm install @dagrejs/dagre
npm install -D @types/dagre
```

`widgets/canvas-board/model/use-auto-layout.ts` 추가. dagre 연동은 Plan Section 9 참조.

### 11.2 단축키

- `Delete` → 선택 노드/엣지 삭제 (React Flow 내장)
- `Ctrl+A` → 전체 선택 (React Flow 내장)
- 추가 단축키는 Phase 3에서 정의

---

## 12. 의존성

```bash
# Phase 1
npm install @xyflow/react

# Phase 3
npm install @dagrejs/dagre
npm install -D @types/dagre
```

---

## 13. 파일 종합

### Phase 1 신규 파일 (~31개)

| 레이어  | 파일                                                              | 설명                            |
| ------- | ----------------------------------------------------------------- | ------------------------------- |
| Schema  | `src/main/db/schema/canvas.ts`                                    | canvases 테이블                 |
| Schema  | `src/main/db/schema/canvas-node.ts`                               | canvas_nodes 테이블             |
| Schema  | `src/main/db/schema/canvas-edge.ts`                               | canvas_edges 테이블             |
| Schema  | `src/main/db/schema/canvas-group.ts`                              | canvas_groups 테이블 (스키마만) |
| Repo    | `src/main/repositories/canvas.ts`                                 | 캔버스 CRUD                     |
| Repo    | `src/main/repositories/canvas-node.ts`                            | 노드 CRUD + bulk position       |
| Repo    | `src/main/repositories/canvas-edge.ts`                            | 엣지 CRUD                       |
| Service | `src/main/services/canvas.ts`                                     | 캔버스 비즈니스 로직            |
| Service | `src/main/services/canvas-node.ts`                                | 노드 + ref batch fetch          |
| Service | `src/main/services/canvas-edge.ts`                                | 엣지 + 유효성 검사              |
| IPC     | `src/main/ipc/canvas.ts`                                          | canvas:\* 채널 (6개)            |
| IPC     | `src/main/ipc/canvas-node.ts`                                     | canvasNode:\* 채널 (5개)        |
| IPC     | `src/main/ipc/canvas-edge.ts`                                     | canvasEdge:\* 채널 (4개)        |
| Entity  | `src/renderer/src/entities/canvas/model/types.ts`                 | 타입 정의                       |
| Entity  | `src/renderer/src/entities/canvas/model/queries.ts`               | React Query 훅 (14개)           |
| Entity  | `src/renderer/src/entities/canvas/model/converters.ts`            | DB↔RF 변환                      |
| Entity  | `src/renderer/src/entities/canvas/index.ts`                       | barrel                          |
| Page    | `src/renderer/src/pages/canvas/ui/CanvasListPage.tsx`             | 리스트 페이지                   |
| Page    | `src/renderer/src/pages/canvas/index.ts`                          | barrel                          |
| Page    | `src/renderer/src/pages/canvas-detail/ui/CanvasDetailPage.tsx`    | 디테일 페이지                   |
| Page    | `src/renderer/src/pages/canvas-detail/index.ts`                   | barrel                          |
| Widget  | `src/renderer/src/widgets/canvas-board/ui/CanvasBoard.tsx`        | React Flow 통합                 |
| Widget  | `src/renderer/src/widgets/canvas-board/ui/TextNodeContent.tsx`    | 텍스트 노드                     |
| Widget  | `src/renderer/src/widgets/canvas-board/ui/RefNodeContent.tsx`     | Ref 노드                        |
| Widget  | `src/renderer/src/widgets/canvas-board/ui/CustomEdge.tsx`         | 커스텀 엣지                     |
| Widget  | `src/renderer/src/widgets/canvas-board/ui/CanvasToolbar.tsx`      | 도구 모음                       |
| Widget  | `src/renderer/src/widgets/canvas-board/model/canvas-store.ts`     | Zustand store                   |
| Widget  | `src/renderer/src/widgets/canvas-board/model/use-canvas-data.ts`  | 데이터 훅                       |
| Widget  | `src/renderer/src/widgets/canvas-board/model/use-canvas-flush.ts` | 위치 flush                      |
| Widget  | `src/renderer/src/widgets/canvas-board/model/types.ts`            | 노드 데이터 타입                |
| Widget  | `src/renderer/src/widgets/canvas-board/index.ts`                  | barrel                          |

### Phase 1 수정 파일 (~12개)

| 파일                                                | 변경                                     |
| --------------------------------------------------- | ---------------------------------------- |
| `src/main/db/schema/index.ts`                       | 4개 schema export 추가                   |
| `src/main/index.ts`                                 | 3개 registerHandlers 호출 추가           |
| `src/main/repositories/todo.ts`                     | `findByIds()` 추가                       |
| `src/main/repositories/note.ts`                     | `findByIds()` 추가                       |
| `src/main/repositories/schedule.ts`                 | `findByIds()` 추가                       |
| `src/main/repositories/csv-file.ts`                 | `findByIds()` 추가                       |
| `src/main/repositories/pdf-file.ts`                 | `findByIds()` 추가                       |
| `src/main/repositories/image-file.ts`               | `findByIds()` 추가                       |
| `src/preload/index.d.ts`                            | Canvas 타입 + API 인터페이스             |
| `src/preload/index.ts`                              | canvas/canvasNode/canvasEdge bridge      |
| `src/renderer/src/shared/constants/tab-url.ts`      | TabType, ROUTES, TAB_ICON, sidebar_items |
| `src/renderer/src/app/layout/model/pane-routes.tsx` | 2개 lazy route 추가                      |

---

## 14. 검증 체크리스트

### Phase 1 완료 기준

- [ ] `npm run typecheck` 통과
- [ ] `npm run db:generate && npm run db:migrate` 성공
- [ ] 사이드바 "캔버스" 클릭 → 리스트 페이지
- [ ] 새 캔버스 생성 → 디테일 페이지로 이동
- [ ] 빈 공간 더블클릭 → text 노드 생성
- [ ] 노드 드래그 이동 → 위치 DB 저장
- [ ] 줌/팬 동작
- [ ] 뷰포트 저장 → 재열기 시 복원
- [ ] 핸들 드래그로 엣지 연결 → DB 저장
- [ ] 엣지 베지어 커브 렌더링
- [ ] 노드/엣지 Delete키 삭제
- [ ] 노드 삭제 시 연결 엣지 자동 제거
- [ ] 미니맵, 배경 그리드, 줌 컨트롤 표시
- [ ] 스냅 그리드 (20px)

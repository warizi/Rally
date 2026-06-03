/**
 * 테스트용 DB 시드 헬퍼. backup·trash 통합 테스트 공유.
 *
 * 모든 시드 함수는 schema의 실제 컬럼 시그니처를 그대로 따른다.
 * (가이드 추정과 schema가 다를 수 있으므로 schema 파일과 항상 일치 유지 필수)
 */
import { nanoid } from 'nanoid'
import { testDb } from '../../../__tests__/setup'
import * as schema from '../../../db/schema'

const now = (): Date => new Date()

interface WorkspaceOverride {
  id?: string
  name?: string
  path?: string
  createdAt?: Date
  updatedAt?: Date
}

interface FolderOverride {
  id?: string
  workspaceId?: string
  relativePath?: string
  color?: string | null
  order?: number
  createdAt?: Date
  updatedAt?: Date
}

interface NoteOverride {
  id?: string
  workspaceId?: string
  folderId?: string | null
  relativePath?: string
  title?: string
  description?: string
  preview?: string
  order?: number
  isLocked?: boolean
  createdAt?: Date
  updatedAt?: Date
}

interface TodoOverride {
  id?: string
  workspaceId?: string
  parentId?: string | null
  title?: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
  isDone?: boolean
  listOrder?: number
  kanbanOrder?: number
  subOrder?: number
  createdAt?: Date
  updatedAt?: Date
  dueDate?: Date | null
}

interface ScheduleOverride {
  id?: string
  workspaceId?: string
  title?: string
  description?: string | null
  startAt?: Date
  endAt?: Date
  allDay?: boolean
  priority?: 'low' | 'medium' | 'high'
  createdAt?: Date
  updatedAt?: Date
}

interface CanvasOverride {
  id?: string
  workspaceId?: string
  title?: string
  description?: string
  viewportX?: number
  viewportY?: number
  viewportZoom?: number
  isLocked?: boolean
  createdAt?: Date
  updatedAt?: Date
}

interface CanvasNodeOverride {
  id?: string
  type?: 'text' | 'todo' | 'note' | 'schedule' | 'csv' | 'pdf' | 'image' | 'canvas'
  refId?: string | null
  x?: number
  y?: number
  width?: number
  height?: number
  zIndex?: number
  color?: string | null
  content?: string | null
  groupId?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export const seed = {
  workspace(overrides: WorkspaceOverride = {}): typeof schema.workspaces.$inferSelect {
    const ws = {
      id: overrides.id ?? nanoid(),
      name: overrides.name ?? 'Test Workspace',
      path: overrides.path ?? '/tmp/test-ws',
      createdAt: overrides.createdAt ?? now(),
      updatedAt: overrides.updatedAt ?? now()
    }
    testDb.insert(schema.workspaces).values(ws).run()
    return ws
  },

  folder(workspaceId: string, overrides: FolderOverride = {}): typeof schema.folders.$inferSelect {
    const folder = {
      id: overrides.id ?? nanoid(),
      workspaceId,
      relativePath: overrides.relativePath ?? `Folder-${nanoid(6)}`,
      color: overrides.color ?? null,
      order: overrides.order ?? 0,
      createdAt: overrides.createdAt ?? now(),
      updatedAt: overrides.updatedAt ?? now(),
      createdBy: 'user' as const,
      createdById: null,
      updatedBy: 'user' as const,
      updatedById: null,
      deletedAt: null,
      trashBatchId: null
    }
    testDb.insert(schema.folders).values(folder).run()
    return folder
  },

  note(workspaceId: string, overrides: NoteOverride = {}): typeof schema.notes.$inferSelect {
    const title = overrides.title ?? 'Note'
    const note = {
      id: overrides.id ?? nanoid(),
      workspaceId,
      folderId: overrides.folderId ?? null,
      relativePath: overrides.relativePath ?? `${title}.md`,
      title,
      description: overrides.description ?? '',
      preview: overrides.preview ?? '',
      order: overrides.order ?? 0,
      isLocked: overrides.isLocked ?? false,
      createdAt: overrides.createdAt ?? now(),
      updatedAt: overrides.updatedAt ?? now(),
      createdBy: 'user' as const,
      createdById: null,
      updatedBy: 'user' as const,
      updatedById: null,
      deletedAt: null,
      trashBatchId: null
    }
    testDb.insert(schema.notes).values(note).run()
    return note
  },

  todo(workspaceId: string, overrides: TodoOverride = {}): typeof schema.todos.$inferSelect {
    const todo = {
      id: overrides.id ?? nanoid(),
      workspaceId,
      parentId: overrides.parentId ?? null,
      title: overrides.title ?? 'Todo',
      description: overrides.description ?? '',
      status: overrides.status ?? ('할일' as const),
      priority: overrides.priority ?? ('medium' as const),
      isDone: overrides.isDone ?? false,
      listOrder: overrides.listOrder ?? 0,
      kanbanOrder: overrides.kanbanOrder ?? 0,
      subOrder: overrides.subOrder ?? 0,
      createdAt: overrides.createdAt ?? now(),
      updatedAt: overrides.updatedAt ?? now(),
      createdBy: 'user' as const,
      createdById: null,
      updatedBy: 'user' as const,
      updatedById: null,
      doneAt: null,
      dueDate: overrides.dueDate ?? null,
      startDate: null,
      deletedAt: null,
      trashBatchId: null
    }
    testDb.insert(schema.todos).values(todo).run()
    return todo
  },

  schedule(
    workspaceId: string,
    overrides: ScheduleOverride = {}
  ): typeof schema.schedules.$inferSelect {
    const startAt = overrides.startAt ?? now()
    const sched = {
      id: overrides.id ?? nanoid(),
      workspaceId,
      title: overrides.title ?? 'Schedule',
      description: overrides.description ?? null,
      location: null,
      allDay: overrides.allDay ?? false,
      startAt,
      endAt: overrides.endAt ?? new Date(startAt.getTime() + 3600 * 1000),
      color: null,
      priority: overrides.priority ?? ('medium' as const),
      createdAt: overrides.createdAt ?? now(),
      updatedAt: overrides.updatedAt ?? now(),
      createdBy: 'user' as const,
      createdById: null,
      updatedBy: 'user' as const,
      updatedById: null,
      deletedAt: null,
      trashBatchId: null
    }
    testDb.insert(schema.schedules).values(sched).run()
    return sched
  },

  canvas(workspaceId: string, overrides: CanvasOverride = {}): typeof schema.canvases.$inferSelect {
    const canvas = {
      id: overrides.id ?? nanoid(),
      workspaceId,
      title: overrides.title ?? 'Canvas',
      description: overrides.description ?? '',
      viewportX: overrides.viewportX ?? 0,
      viewportY: overrides.viewportY ?? 0,
      viewportZoom: overrides.viewportZoom ?? 1,
      isLocked: overrides.isLocked ?? false,
      createdAt: overrides.createdAt ?? now(),
      updatedAt: overrides.updatedAt ?? now(),
      createdBy: 'user' as const,
      createdById: null,
      updatedBy: 'user' as const,
      updatedById: null,
      deletedAt: null,
      trashBatchId: null
    }
    testDb.insert(schema.canvases).values(canvas).run()
    return canvas
  },

  canvasNode(
    canvasId: string,
    overrides: CanvasNodeOverride = {}
  ): typeof schema.canvasNodes.$inferSelect {
    const node = {
      id: overrides.id ?? nanoid(),
      canvasId,
      type: overrides.type ?? ('text' as const),
      refId: overrides.refId ?? null,
      x: overrides.x ?? 0,
      y: overrides.y ?? 0,
      width: overrides.width ?? 260,
      height: overrides.height ?? 160,
      color: overrides.color ?? null,
      content: overrides.content ?? null,
      zIndex: overrides.zIndex ?? 0,
      groupId: overrides.groupId ?? null,
      createdAt: overrides.createdAt ?? now(),
      updatedAt: overrides.updatedAt ?? now(),
      deletedAt: null,
      trashBatchId: null
    }
    testDb.insert(schema.canvasNodes).values(node).run()
    return node
  },

  canvasEdge(
    canvasId: string,
    fromNode: string,
    toNode: string,
    overrides: { id?: string; label?: string | null; createdAt?: Date } = {}
  ): typeof schema.canvasEdges.$inferSelect {
    const edge = {
      id: overrides.id ?? nanoid(),
      canvasId,
      fromNode,
      toNode,
      fromSide: 'right' as const,
      toSide: 'left' as const,
      label: overrides.label ?? null,
      color: null,
      style: 'solid' as const,
      arrow: 'end' as const,
      createdAt: overrides.createdAt ?? now(),
      deletedAt: null,
      trashBatchId: null
    }
    testDb.insert(schema.canvasEdges).values(edge).run()
    return edge
  }
}

/**
 * 라운드트립 검증용 풍부한 워크스페이스.
 * 모든 entity 타입을 1개 이상 포함 (FK 관계 포함).
 */
export interface SeededWorkspace {
  ws: typeof schema.workspaces.$inferSelect
  folders: (typeof schema.folders.$inferSelect)[]
  notes: (typeof schema.notes.$inferSelect)[]
  todos: (typeof schema.todos.$inferSelect)[]
  schedules: (typeof schema.schedules.$inferSelect)[]
  canvases: (typeof schema.canvases.$inferSelect)[]
  canvasNodes: (typeof schema.canvasNodes.$inferSelect)[]
  canvasEdges: (typeof schema.canvasEdges.$inferSelect)[]
}

export function seedFullWorkspace(opts: {
  workspaceId?: string
  workspacePath: string
  name?: string
}): SeededWorkspace {
  const ws = seed.workspace({
    id: opts.workspaceId,
    name: opts.name ?? 'Full',
    path: opts.workspacePath
  })

  // 폴더 트리 3단 (relativePath로 깊이 표현)
  const f1 = seed.folder(ws.id, { relativePath: 'Top', order: 0 })
  const f2 = seed.folder(ws.id, { relativePath: 'Top/Sub', order: 0 })
  const f3 = seed.folder(ws.id, { relativePath: 'Top/Sub/Deep', order: 0 })

  // 노트 (root / L1 / L3)
  const n1 = seed.note(ws.id, { folderId: null, title: 'Root note', relativePath: 'Root note.md' })
  const n2 = seed.note(ws.id, {
    folderId: f1.id,
    title: 'L1 note',
    relativePath: 'Top/L1 note.md'
  })
  const n3 = seed.note(ws.id, {
    folderId: f3.id,
    title: 'L3 note',
    relativePath: 'Top/Sub/Deep/L3 note.md'
  })

  // 할일 (부모 + 자식)
  const t1 = seed.todo(ws.id, { title: 'Parent todo', priority: 'high' })
  const t2 = seed.todo(ws.id, { parentId: t1.id, title: 'Child todo' })

  // 일정
  const s1 = seed.schedule(ws.id, { title: 'Meeting' })

  // 캔버스 + 노드 2개 + 엣지 1개
  const c1 = seed.canvas(ws.id, { title: 'Diagram' })
  const cn1 = seed.canvasNode(c1.id, { type: 'text', content: 'A' })
  const cn2 = seed.canvasNode(c1.id, { type: 'text', content: 'B', x: 300 })
  const ce1 = seed.canvasEdge(c1.id, cn1.id, cn2.id, { label: 'A→B' })

  return {
    ws,
    folders: [f1, f2, f3],
    notes: [n1, n2, n3],
    todos: [t1, t2],
    schedules: [s1],
    canvases: [c1],
    canvasNodes: [cn1, cn2],
    canvasEdges: [ce1]
  }
}

/**
 * 위험 IPC 채널의 zod 입력 스키마.
 *
 * 보안-1 Phase 3 — sandbox=true 전환 전에 렌더러로부터 들어오는 위험한 입력
 * (cwd, zip 경로, 워크스페이스 경로 등) 을 모두 검증한다.
 *
 * 화이트리스트 디렉토리 검증은 service 레이어가 path.resolve + workspace 디렉토리
 * prefix 검사로 보완. 이 파일은 형식 검증만 책임진다.
 */
import { z } from 'zod'
import { idSchema, safePathSchema, nonEmptyStringSchema } from '../lib/ipc-validate'

/** .zip 확장자 강제 + path traversal 차단. */
export const zipPathSchema = safePathSchema.refine(
  (p) => p.toLowerCase().endsWith('.zip'),
  '.zip 확장자가 아닙니다'
)

/**
 * 외부 파일 import 시 렌더러가 넘기는 소스 경로 (보통 파일 dialog 결과).
 * path traversal(`..`) 차단 + 길이 제한. 화이트리스트/확장자 검증은 service 레이어 책임.
 */
export const externalFilePathSchema = safePathSchema.max(4096)

/** 워크스페이스 내부 상대 경로 (note 이미지 등). path traversal 차단 + 길이 제한. */
export const relativeFilePathSchema = safePathSchema.max(4096)

/* ------------------------------------------------------------------ */
/* todo 도메인 CRUD 스키마 — 대표 CRUD 런타임 검증                       */
/* ------------------------------------------------------------------ */

const todoStatusSchema = z.enum(['할일', '진행중', '완료', '보류'])
const todoPrioritySchema = z.enum(['high', 'medium', 'low'])

/**
 * Electron IPC 는 structured clone 으로 Date 를 보존하지만, 직렬화 경로(문자열)도
 * 대비해 `z.coerce.date()` 사용. null = 명시적 해제, undefined/키 미전달 = 변경 없음.
 */
const nullableDateSchema = z.coerce.date().nullable().optional()

/** todo:create payload. 누락 불가 필드는 title 뿐. */
export const createTodoSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(10000).optional(),
  status: todoStatusSchema.optional(),
  priority: todoPrioritySchema.optional(),
  parentId: idSchema.nullable().optional(),
  dueDate: nullableDateSchema,
  startDate: nullableDateSchema
})

/** todo:update payload. 모든 필드 optional (부분 갱신). */
export const updateTodoSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(10000).optional(),
  status: todoStatusSchema.optional(),
  priority: todoPrioritySchema.optional(),
  isDone: z.boolean().optional(),
  parentId: idSchema.nullable().optional(),
  dueDate: nullableDateSchema,
  startDate: nullableDateSchema
})

/** reorder*(list/kanban/sub) updates 배열. id 형식 + order 정수 검증. */
export const todoOrderUpdatesSchema = z.array(
  z.object({
    id: idSchema,
    order: z.number().int(),
    status: todoStatusSchema.optional()
  })
)

/** todo:findByDateRange range — start/end 둘 다 필수 Date. */
export const todoDateRangeSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date()
})

/** todo:findByWorkspace options — filter enum (optional). */
export const todoFilterOptionsSchema = z
  .object({
    filter: z.enum(['all', 'active', 'completed']).optional()
  })
  .optional()

/** terminal:create — PTY 생성 인자 (1개 객체). */
export const terminalCreateSchema = z.object({
  workspaceId: idSchema,
  cwd: safePathSchema,
  // shell 경로/이름 — null/undefined 허용. 너무 길거나 NUL 포함 차단.
  shell: z
    .string()
    .max(255)
    .refine((s) => !s.includes('\0'), 'shell name must not contain NUL')
    .optional(),
  cols: z.number().int().min(1).max(10000),
  rows: z.number().int().min(1).max(10000),
  id: idSchema.optional(),
  sortOrder: z.number().int().nonnegative().optional()
})

/** workspace:create — 이름 + 경로. */
export const workspaceNameSchema = z.string().trim().min(1).max(255)

/** workspace path — sandbox=true 모드에서 사용자가 dialog 로 선택한 경로 외에는 차단. */
export const workspacePathSchema = safePathSchema.max(4096)

/* ================================================================== */
/* 공용 building-block 스키마 — 도메인 CRUD 전반에서 재사용                */
/* ================================================================== */

/** nanoid id 의 nullable 버전 (folderId 등 "루트=null" 표현). */
export const nullableIdSchema = idSchema.nullable()

/** 제목/이름 — 공백 trim 후 1~255자. */
export const titleSchema = z.string().trim().min(1).max(255)

/** 설명 — 최대 10,000자 (빈 문자열 허용). */
export const descriptionSchema = z.string().max(10000)

/** note/csv 본문·snapshot 등 대용량 문자열. 무제한은 DoS 위험이라 상한만 둔다(매우 관대). */
export const contentSchema = z.string().max(50_000_000)

/** JSON 직렬화 문자열 payload (tabsJson, layoutJson, settingsJson 등). */
export const jsonStringSchema = z.string().max(50_000_000)

/** 색상 토큰/HEX 등 — 형식은 service 가 보정, 여기선 길이만 제한. */
export const colorSchema = z.string().max(50)

/** 정렬/순서 index. */
export const orderIndexSchema = z.number().int()

/** 잠금/플래그 등 boolean 입력. */
export const booleanSchema = z.boolean()

/** binary payload (note 이미지 붙여넣기 등). structured clone 으로 ArrayBuffer 보존. */
export const arrayBufferSchema = z.instanceof(ArrayBuffer)

/** 파일 확장자 — 점 없는 짧은 영숫자. */
export const fileExtSchema = z.string().min(1).max(10)

/** Electron structured-clone Date + 직렬화(문자열) 모두 대비. */
export const dateSchema = z.coerce.date()

/** 공용 우선순위 enum. */
export const prioritySchema = z.enum(['high', 'medium', 'low'])

/* ----- 도메인 enum 스키마 (union 타입의 런타임 형태) ----- */

/** entity-link 가능한 엔티티 타입. db/schema/entity-link.ts 의 LinkableEntityType 와 동기화. */
export const linkableEntityTypeSchema = z.enum([
  'todo',
  'schedule',
  'note',
  'pdf',
  'csv',
  'image',
  'canvas'
])

/** 태그 부착 가능한 엔티티 타입. db/schema/tag.ts 의 TaggableEntityType 와 동기화. */
export const taggableEntityTypeSchema = z.enum([
  'note',
  'todo',
  'image',
  'pdf',
  'csv',
  'canvas',
  'folder'
])

/** reminder 대상 엔티티 타입. */
export const reminderEntityTypeSchema = z.enum(['todo', 'schedule'])

/** trash 대상 엔티티 종류. services/trash/types.ts 의 TrashEntityKind 와 동기화. */
export const trashEntityKindSchema = z.enum([
  'folder',
  'note',
  'csv',
  'pdf',
  'image',
  'canvas',
  'todo',
  'schedule',
  'recurring_rule',
  'template',
  'custom_skill'
])

/** trash 보관 기간 키. */
export const trashRetentionKeySchema = z.enum(['1', '7', '30', '90', '365', 'never'])

/** template 종류. */
export const templateTypeSchema = z.enum(['note', 'csv'])

/** skill 적용 타겟. */
export const skillTargetSchema = z.enum(['claude', 'codex'])

/** MCP 클라이언트 식별자. services/mcp-client-config.ts 의 McpClientId 와 동기화. */
export const mcpClientIdSchema = z.enum(['claudeDesktop', 'claudeCode', 'codex'])

/** 반복 규칙 타입. */
export const recurrenceTypeSchema = z.enum(['daily', 'weekday', 'weekend', 'custom'])

/** canvas 노드 타입. db/schema/canvas-node.ts 의 CanvasNodeType 와 동기화. */
export const canvasNodeTypeSchema = z.enum([
  'text',
  'todo',
  'note',
  'schedule',
  'csv',
  'pdf',
  'image',
  'canvas'
])

const canvasEdgeSideSchema = z.enum(['top', 'right', 'bottom', 'left'])
const canvasEdgeStyleSchema = z.enum(['solid', 'dashed', 'dotted'])
const canvasEdgeArrowSchema = z.enum(['none', 'end', 'both'])

/* ================================================================== */
/* note / csv / pdf / image / folder — 파일·폴더 도메인                  */
/* ================================================================== */

/** note/csv updateMeta 등에서 쓰는 description-only 메타. */
export const descriptionMetaSchema = z.object({
  description: descriptionSchema.optional()
})

/** csv updateMeta — description + columnWidths. */
export const csvUpdateMetaSchema = z.object({
  description: descriptionSchema.optional(),
  columnWidths: z.string().max(100_000).optional()
})

/** folder updateMeta — color/order. */
export const folderUpdateMetaSchema = z.object({
  color: colorSchema.nullable().optional(),
  order: orderIndexSchema.optional()
})

/* ================================================================== */
/* canvas / canvas-node / canvas-edge / canvas-group                   */
/* ================================================================== */

export const canvasCreateSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.optional()
})

export const canvasUpdateSchema = z.object({
  title: titleSchema.optional(),
  description: descriptionSchema.optional()
})

export const canvasViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number()
})

export const canvasFindOptionsSchema = z
  .object({ search: z.string().max(1000).optional() })
  .optional()

export const canvasNodeCreateSchema = z.object({
  type: canvasNodeTypeSchema,
  refId: idSchema.optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  color: colorSchema.optional(),
  content: contentSchema.optional(),
  groupId: idSchema.nullable().optional()
})

export const canvasNodeUpdateSchema = z.object({
  content: contentSchema.optional(),
  color: colorSchema.optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  zIndex: z.number().int().optional(),
  groupId: idSchema.nullable().optional(),
  x: z.number().optional(),
  y: z.number().optional()
})

export const canvasNodePositionsSchema = z.array(
  z.object({ id: idSchema, x: z.number(), y: z.number() })
)

/**
 * canvasNode:syncState payload — nodes/edges/groups 배열의 deep shape 는 service 가
 * 검증/매핑한다. IPC boundary 는 "배열 형태인가"만 보장(요소는 unknown 통과).
 */
export const canvasSyncStateSchema = z.object({
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
  groups: z.array(z.unknown()).optional()
})

export const canvasEdgeCreateSchema = z.object({
  fromNode: idSchema,
  toNode: idSchema,
  fromSide: canvasEdgeSideSchema.optional(),
  toSide: canvasEdgeSideSchema.optional(),
  label: z.string().max(1000).optional(),
  color: colorSchema.optional(),
  style: canvasEdgeStyleSchema.optional(),
  arrow: canvasEdgeArrowSchema.optional()
})

export const canvasEdgeUpdateSchema = z.object({
  fromSide: canvasEdgeSideSchema.optional(),
  toSide: canvasEdgeSideSchema.optional(),
  label: z.string().max(1000).optional(),
  color: colorSchema.optional(),
  style: canvasEdgeStyleSchema.optional(),
  arrow: canvasEdgeArrowSchema.optional()
})

export const canvasGroupCreateSchema = z.object({
  label: z.string().max(1000).optional(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  color: colorSchema.optional()
})

export const canvasGroupUpdateSchema = z.object({
  label: z.string().max(1000).nullable().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  color: colorSchema.nullable().optional()
})

/* ================================================================== */
/* schedule / recurring-rule / reminder                               */
/* ================================================================== */

export const scheduleDateRangeSchema = z.object({
  start: dateSchema,
  end: dateSchema
})

export const scheduleCreateSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.nullable().optional(),
  location: z.string().max(1000).nullable().optional(),
  allDay: z.boolean().optional(),
  startAt: dateSchema,
  endAt: dateSchema,
  color: colorSchema.nullable().optional(),
  priority: prioritySchema.optional()
})

export const scheduleUpdateSchema = z.object({
  title: titleSchema.optional(),
  description: descriptionSchema.nullable().optional(),
  location: z.string().max(1000).nullable().optional(),
  allDay: z.boolean().optional(),
  startAt: dateSchema.optional(),
  endAt: dateSchema.optional(),
  color: colorSchema.nullable().optional(),
  priority: prioritySchema.optional()
})

const daysOfWeekSchema = z.array(z.number().int().min(0).max(6))

export const recurringRuleCreateSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.optional(),
  priority: prioritySchema.optional(),
  recurrenceType: recurrenceTypeSchema,
  daysOfWeek: daysOfWeekSchema.optional(),
  startDate: dateSchema,
  endDate: dateSchema.nullable().optional(),
  startTime: z.string().max(20).nullable().optional(),
  endTime: z.string().max(20).nullable().optional(),
  reminderOffsetMs: z.number().int().nullable().optional()
})

export const recurringRuleUpdateSchema = z.object({
  title: titleSchema.optional(),
  description: descriptionSchema.optional(),
  priority: prioritySchema.optional(),
  recurrenceType: recurrenceTypeSchema.optional(),
  daysOfWeek: daysOfWeekSchema.nullable().optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.nullable().optional(),
  startTime: z.string().max(20).nullable().optional(),
  endTime: z.string().max(20).nullable().optional(),
  reminderOffsetMs: z.number().int().nullable().optional()
})

export const reminderSetSchema = z.object({
  entityType: reminderEntityTypeSchema,
  entityId: idSchema,
  offsetMs: z.number().int()
})

/* ================================================================== */
/* tag / template / note-style-template / skill                       */
/* ================================================================== */

export const tagCreateSchema = z.object({
  name: titleSchema,
  color: colorSchema,
  description: descriptionSchema.optional()
})

export const tagUpdateSchema = z.object({
  name: titleSchema.optional(),
  color: colorSchema.optional(),
  description: descriptionSchema.nullable().optional()
})

export const templateCreateSchema = z.object({
  workspaceId: idSchema,
  title: titleSchema,
  type: templateTypeSchema,
  jsonData: jsonStringSchema
})

export const noteStyleTemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  settingsJson: jsonStringSchema
})

export const skillCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().max(4000),
  content: z.string().max(100_000),
  mcpTools: z.array(z.string().max(200)).optional(),
  triggers: z.array(z.string().max(200)).optional()
})

export const skillUpdateSchema = z.object({
  description: z.string().max(4000).optional(),
  content: z.string().max(100_000).optional(),
  mcpTools: z.array(z.string().max(200)).optional(),
  triggers: z.array(z.string().max(200)).optional()
})

/* ================================================================== */
/* tab-session / tab-snapshot / terminal / trash / history / workspace */
/* ================================================================== */

export const tabSessionUpsertSchema = z.object({
  workspaceId: idSchema,
  tabsJson: jsonStringSchema,
  panesJson: jsonStringSchema,
  layoutJson: jsonStringSchema,
  activePaneId: nonEmptyStringSchema
})

export const tabSnapshotCreateSchema = z.object({
  name: titleSchema,
  description: descriptionSchema.optional(),
  workspaceId: idSchema,
  tabsJson: jsonStringSchema,
  panesJson: jsonStringSchema,
  layoutJson: jsonStringSchema
})

export const tabSnapshotUpdateSchema = z.object({
  name: titleSchema.optional(),
  description: descriptionSchema.optional(),
  tabsJson: jsonStringSchema.optional(),
  panesJson: jsonStringSchema.optional(),
  layoutJson: jsonStringSchema.optional()
})

export const terminalUpdateSessionSchema = z.object({
  name: z.string().max(255).optional(),
  cwd: safePathSchema.max(4096).optional(),
  rows: z.number().int().min(1).max(10000).optional(),
  cols: z.number().int().min(1).max(10000).optional(),
  screenSnapshot: z.string().max(50_000_000).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional()
})

export const trashListOptionsSchema = z
  .object({
    types: z.array(trashEntityKindSchema).optional(),
    search: z.string().max(1000).optional(),
    offset: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().optional()
  })
  .optional()

export const historyFetchOptionsSchema = z
  .object({
    dayOffset: z.number().int().optional(),
    dayLimit: z.number().int().optional(),
    fromDate: z.string().max(40).nullable().optional(),
    toDate: z.string().max(40).nullable().optional(),
    query: z.string().max(1000).nullable().optional()
  })
  .optional()

export const workspaceUpdateSchema = z.object({
  name: workspaceNameSchema.optional(),
  path: workspacePathSchema.optional(),
  updatedAt: dateSchema.optional()
})

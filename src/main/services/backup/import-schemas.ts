import { z } from 'zod'

/**
 * 백업 zip 의 import JSON 스키마 (Phase 3 zod 도입).
 *
 * 모든 timestamp 는 `serializeForExport` 가 Date → number(ms) 로 변환했으므로
 * 검증 단계에서는 number 로 받음.
 *
 * `.passthrough()` 사용: 명시 필드는 strict 하게 검증하되, 미지의 추가 필드는
 * 통과 (이전 버전 백업 호환성 유지). 누락된 필수 필드는 ZodError throw.
 *
 * silent fallback 제거: 기존엔 missing/malformed JSON 이 임의 처리됐으나,
 * 이제는 ValidationError 로 즉시 거부.
 */

// ─── 공통 ──────────────────────────────────────────

/**
 * epoch ms timestamp.
 *
 * 호환성: 신규 백업 (Phase 3+) 은 number 로 직렬화, 구버전 (Phase 2 이하)은
 * `Date.toJSON()` 의 ISO string 으로 직렬화됐음. zod 는 둘 다 허용,
 * toDate / toDateOrNull 이 `new Date()` 로 둘 다 처리.
 */
const Ts = z.union([z.number(), z.string()])
const TsNullable = z.union([z.number(), z.string(), z.null()])

// ─── 각 entity import 스키마 ───────────────────────

export const FolderImport = z
  .object({
    id: z.string(),
    relativePath: z.string(),
    color: z.string().nullable(),
    order: z.number(),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

export const NoteImport = z
  .object({
    id: z.string(),
    folderId: z.string().nullable(),
    title: z.string(),
    relativePath: z.string(),
    description: z.string(),
    preview: z.string(),
    order: z.number(),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

export const CsvFileImport = z
  .object({
    id: z.string(),
    folderId: z.string().nullable(),
    title: z.string(),
    relativePath: z.string(),
    description: z.string(),
    preview: z.string(),
    columnWidths: z.string().nullable(),
    order: z.number(),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

export const PdfFileImport = z
  .object({
    id: z.string(),
    folderId: z.string().nullable(),
    title: z.string(),
    relativePath: z.string(),
    description: z.string(),
    preview: z.string(),
    order: z.number(),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

export const ImageFileImport = z
  .object({
    id: z.string(),
    folderId: z.string().nullable(),
    title: z.string(),
    relativePath: z.string(),
    description: z.string(),
    preview: z.string(),
    order: z.number(),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

export const TodoImport = z
  .object({
    id: z.string(),
    parentId: z.string().nullable(),
    title: z.string(),
    description: z.string(),
    status: z.enum(['할일', '진행중', '완료', '보류']),
    priority: z.enum(['high', 'medium', 'low']),
    isDone: z.boolean(),
    listOrder: z.number(),
    kanbanOrder: z.number(),
    subOrder: z.number(),
    createdAt: Ts,
    updatedAt: Ts,
    doneAt: TsNullable,
    dueDate: TsNullable,
    startDate: TsNullable
  })
  .passthrough()

export const ScheduleImport = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    location: z.string().nullable(),
    allDay: z.boolean(),
    startAt: Ts,
    endAt: Ts,
    color: z.string().nullable(),
    priority: z.enum(['low', 'medium', 'high']),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

export const ScheduleTodoImport = z
  .object({
    scheduleId: z.string(),
    todoId: z.string()
  })
  .passthrough()

export const EntityLinkImport = z
  .object({
    sourceType: z.string(),
    sourceId: z.string(),
    targetType: z.string(),
    targetId: z.string(),
    createdAt: Ts
  })
  .passthrough()

export const CanvasImport = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    viewportX: z.number(),
    viewportY: z.number(),
    viewportZoom: z.number(),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

export const CanvasNodeImport = z
  .object({
    id: z.string(),
    canvasId: z.string(),
    type: z.string(),
    refId: z.string().nullable(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    color: z.string().nullable(),
    content: z.string().nullable(),
    zIndex: z.number(),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

export const CanvasEdgeImport = z
  .object({
    id: z.string(),
    canvasId: z.string(),
    fromNode: z.string(),
    toNode: z.string(),
    fromSide: z.string().nullable(),
    toSide: z.string().nullable(),
    label: z.string().nullable(),
    color: z.string().nullable(),
    style: z.string().nullable(),
    arrow: z.string().nullable(),
    createdAt: Ts
  })
  .passthrough()

export const CanvasGroupImport = z
  .object({
    id: z.string(),
    canvasId: z.string(),
    label: z.string().nullable(),
    color: z.string().nullable(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

export const TagImport = z
  .object({
    id: z.string(),
    name: z.string(),
    color: z.string().nullable(),
    description: z.string().nullable(),
    createdAt: Ts
  })
  .passthrough()

export const ItemTagImport = z
  .object({
    id: z.string(),
    itemType: z.string(),
    tagId: z.string(),
    itemId: z.string(),
    createdAt: Ts
  })
  .passthrough()

export const TabSessionImport = z
  .object({
    activePaneId: z.string().nullable(),
    tabsJson: z.string(),
    panesJson: z.string(),
    layoutJson: z.string()
  })
  .passthrough()

export const TabSnapshotImport = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    tabsJson: z.string(),
    panesJson: z.string(),
    layoutJson: z.string(),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

export const ReminderImport = z
  .object({
    id: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    offsetMs: z.number(),
    remindAt: Ts,
    isFired: z.boolean(),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

export const RecurringRuleImport = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    priority: z.enum(['high', 'medium', 'low']),
    recurrenceType: z.enum(['daily', 'weekday', 'weekend', 'custom']),
    daysOfWeek: z.string().nullable(),
    startDate: Ts,
    endDate: TsNullable,
    startTime: z.string().nullable(),
    endTime: z.string().nullable(),
    reminderOffsetMs: z.number().nullable(),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

export const RecurringCompletionImport = z
  .object({
    id: z.string(),
    ruleId: z.string().nullable(),
    ruleTitle: z.string(),
    completedDate: z.string(),
    completedAt: Ts,
    createdAt: Ts
  })
  .passthrough()

export const TemplateImport = z
  .object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['note', 'csv']),
    jsonData: z.string(),
    createdAt: Ts
  })
  .passthrough()

export const TerminalLayoutImport = z
  .object({
    id: z.string(),
    layoutJson: z.string(),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

export const TerminalSessionImport = z
  .object({
    id: z.string(),
    layoutId: z.string().nullable(),
    name: z.string(),
    cwd: z.string().nullable(),
    shell: z.string().nullable(),
    rows: z.number(),
    cols: z.number(),
    screenSnapshot: z.string().nullable(),
    sortOrder: z.number(),
    isActive: z.boolean(),
    createdAt: Ts,
    updatedAt: Ts
  })
  .passthrough()

// ─── 추론된 타입 export (any 0) ────────────────────

export type FolderImportType = z.infer<typeof FolderImport>
export type NoteImportType = z.infer<typeof NoteImport>
export type CsvFileImportType = z.infer<typeof CsvFileImport>
export type PdfFileImportType = z.infer<typeof PdfFileImport>
export type ImageFileImportType = z.infer<typeof ImageFileImport>
export type TodoImportType = z.infer<typeof TodoImport>
export type ScheduleImportType = z.infer<typeof ScheduleImport>
export type ScheduleTodoImportType = z.infer<typeof ScheduleTodoImport>
export type EntityLinkImportType = z.infer<typeof EntityLinkImport>
export type CanvasImportType = z.infer<typeof CanvasImport>
export type CanvasNodeImportType = z.infer<typeof CanvasNodeImport>
export type CanvasEdgeImportType = z.infer<typeof CanvasEdgeImport>
export type CanvasGroupImportType = z.infer<typeof CanvasGroupImport>
export type TagImportType = z.infer<typeof TagImport>
export type ItemTagImportType = z.infer<typeof ItemTagImport>
export type TabSessionImportType = z.infer<typeof TabSessionImport>
export type TabSnapshotImportType = z.infer<typeof TabSnapshotImport>
export type ReminderImportType = z.infer<typeof ReminderImport>
export type RecurringRuleImportType = z.infer<typeof RecurringRuleImport>
export type RecurringCompletionImportType = z.infer<typeof RecurringCompletionImport>
export type TemplateImportType = z.infer<typeof TemplateImport>
export type TerminalLayoutImportType = z.infer<typeof TerminalLayoutImport>
export type TerminalSessionImportType = z.infer<typeof TerminalSessionImport>

/**
 * 모든 entity import schema 의 배열 helper.
 * deserializer 의 readJson<T>() 결과를 `Schema.parse(rawJson)` 으로 검증.
 */

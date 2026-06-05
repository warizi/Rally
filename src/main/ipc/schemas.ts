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
import { idSchema, safePathSchema } from '../lib/ipc-validate'

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

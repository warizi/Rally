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

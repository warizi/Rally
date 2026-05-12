/**
 * IPC 핸들러 입력 검증 헬퍼.
 *
 * Electron 렌더러로부터 들어오는 모든 인자를 zod 스키마로 검증한 뒤 service 호출.
 * 검증 실패 시 throw → 기존 `handle(...)` wrapper 가 잡아서 ErrorResponse 로 반환.
 *
 * 보안-1 의 핵심 진입 게이트: sandbox=true 로 전환하기 전, IPC 표면적의 입력을 모두
 * 신뢰할 수 있는 형태로 만들어 둔다.
 *
 * @example
 * ipcMain.handle(
 *   'note:create',
 *   validateIpc(
 *     [workspaceIdSchema, folderIdSchema.nullable(), z.string().min(1).max(255)],
 *     (workspaceId, folderId, name) => noteService.create(workspaceId, folderId, name)
 *   )
 * )
 */
import type { IpcMainInvokeEvent } from 'electron'
import { z, type ZodType } from 'zod'
import { handle, handleAsync } from './handle'
import type { IpcResponse } from './ipc-response'

type InferArgs<TSchemas extends readonly ZodType[]> = {
  [K in keyof TSchemas]: z.infer<TSchemas[K]>
}

/**
 * 동기 IPC 핸들러를 zod 검증 미들웨어로 감싼다.
 *
 * - `schemas` 배열의 i-th 요소가 i-th 인자에 적용됨.
 * - 모든 인자가 통과하면 `handler` 호출, 결과를 `handle(...)` 로 래핑.
 * - 어느 하나라도 실패하면 ZodError throw → IpcResponse(success=false) 로 변환.
 */
export function validateIpc<TSchemas extends readonly ZodType[], TResult>(
  schemas: TSchemas,
  handler: (...args: InferArgs<TSchemas>) => TResult
): (event: IpcMainInvokeEvent, ...rawArgs: unknown[]) => IpcResponse<TResult> | IpcResponse<never> {
  return (_event, ...rawArgs) =>
    handle(() => {
      const validated = parseAll(schemas, rawArgs) as InferArgs<TSchemas>
      return handler(...validated)
    })
}

/**
 * 비동기 IPC 핸들러를 zod 검증 미들웨어로 감싼다.
 */
export function validateIpcAsync<TSchemas extends readonly ZodType[], TResult>(
  schemas: TSchemas,
  handler: (...args: InferArgs<TSchemas>) => Promise<TResult>
): (
  event: IpcMainInvokeEvent,
  ...rawArgs: unknown[]
) => Promise<IpcResponse<TResult> | IpcResponse<never>> {
  return (_event, ...rawArgs) =>
    handleAsync(async () => {
      const validated = parseAll(schemas, rawArgs) as InferArgs<TSchemas>
      return handler(...validated)
    })
}

function parseAll(schemas: readonly ZodType[], rawArgs: unknown[]): unknown[] {
  return schemas.map((schema, i) => schema.parse(rawArgs[i]))
}

/* ------------------------------------------------------------------ */
/* 공용 스키마 — 자주 쓰이는 입력 검증 유틸                              */
/* ------------------------------------------------------------------ */

/** nanoid (기본 21자, URL-safe alphabet). 길이 ≥ 8 로 느슨하게 허용 (커스텀 길이 대비). */
export const nanoidSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'invalid nanoid format')

/** workspaceId / folderId / noteId 등 도메인 ID. nanoid 와 동일. */
export const idSchema = nanoidSchema

/**
 * 경로 traversal 방지 — `..` segment 차단.
 *
 * 화이트리스트 디렉토리 검증은 호출 측에서 path.resolve + 디렉토리 prefix 검사로 보완.
 */
export const safePathSchema = z
  .string()
  .min(1)
  .refine((p) => !p.split(/[\\/]/).includes('..'), {
    message: 'path traversal (..) is not allowed'
  })

/** non-empty string. 빈 문자열 / 공백만 / 길이 0 거부. */
export const nonEmptyStringSchema = z.string().trim().min(1)

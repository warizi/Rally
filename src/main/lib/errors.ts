/**
 * MCP/IPC 응답에서 error.code로 노출되는 안정적인 식별자.
 * 메시지는 다국어/문구 변경 가능하지만 code는 stable contract.
 */
export enum ErrorCode {
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  WORKSPACE_INACTIVE = 'WORKSPACE_INACTIVE',
  PERMISSION = 'PERMISSION',
  INTERNAL = 'INTERNAL'
}

export class NotFoundError extends Error {
  readonly code = ErrorCode.NOT_FOUND
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends Error {
  readonly code = ErrorCode.VALIDATION
  details?: Record<string, unknown>
  constructor(message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ValidationError'
    this.details = details
  }
}

export class ConflictError extends Error {
  readonly code = ErrorCode.CONFLICT
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class PayloadTooLargeError extends Error {
  readonly code = ErrorCode.PAYLOAD_TOO_LARGE
  constructor() {
    super('Request body too large (max 10MB)')
    this.name = 'PayloadTooLargeError'
  }
}

export class WorkspaceInactiveError extends Error {
  readonly code = ErrorCode.WORKSPACE_INACTIVE
  constructor(message: string = '활성 워크스페이스가 없습니다') {
    super(message)
    this.name = 'WorkspaceInactiveError'
  }
}

export class PermissionError extends Error {
  readonly code = ErrorCode.PERMISSION
  constructor(message: string) {
    super(message)
    this.name = 'PermissionError'
  }
}

/**
 * 정규화된 에러 정보 — router/IPC 등 응답 layer에서 일관된 형식 사용.
 * `code`(stable contract) + `name`(legacy errorType 호환) + `status` + `details`.
 */
export interface NormalizedError {
  status: number
  code: ErrorCode
  name: string
  message: string
  details?: Record<string, unknown>
}

const ERROR_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCode.WORKSPACE_INACTIVE]: 400,
  [ErrorCode.PERMISSION]: 403,
  [ErrorCode.INTERNAL]: 500
}

/**
 * 임의 에러 → NormalizedError. unknown 입력도 안전 처리.
 * - 우리가 정의한 Error 클래스: code 필드 신뢰
 * - 그 외 Error: INTERNAL 500
 * - non-Error: INTERNAL 500 + String 변환
 */
export function normalizeError(e: unknown): NormalizedError {
  if (e instanceof PayloadTooLargeError) {
    return { status: 413, code: ErrorCode.PAYLOAD_TOO_LARGE, name: e.name, message: e.message }
  }
  if (e instanceof NotFoundError) {
    return { status: 404, code: ErrorCode.NOT_FOUND, name: e.name, message: e.message }
  }
  if (e instanceof ValidationError) {
    return {
      status: 400,
      code: ErrorCode.VALIDATION,
      name: e.name,
      message: e.message,
      details: e.details
    }
  }
  if (e instanceof ConflictError) {
    return { status: 409, code: ErrorCode.CONFLICT, name: e.name, message: e.message }
  }
  if (e instanceof WorkspaceInactiveError) {
    return { status: 400, code: ErrorCode.WORKSPACE_INACTIVE, name: e.name, message: e.message }
  }
  if (e instanceof PermissionError) {
    return { status: 403, code: ErrorCode.PERMISSION, name: e.name, message: e.message }
  }
  // 알려지지 않은 우리 Error 클래스 — code 필드 있으면 활용
  if (e instanceof Error) {
    const code = (e as { code?: ErrorCode }).code ?? ErrorCode.INTERNAL
    return {
      status: ERROR_STATUS[code] ?? 500,
      code,
      name: e.name || 'Error',
      message: e.message
    }
  }
  return {
    status: 500,
    code: ErrorCode.INTERNAL,
    name: 'UnknownError',
    message: String(e)
  }
}

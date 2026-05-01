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

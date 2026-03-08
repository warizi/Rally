export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends Error {
  details?: Record<string, unknown>
  constructor(message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ValidationError'
    this.details = details
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class PayloadTooLargeError extends Error {
  constructor() {
    super('Request body too large (max 10MB)')
    this.name = 'PayloadTooLargeError'
  }
}

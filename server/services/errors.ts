import type { Field, FieldErrors } from '@shared/validation'

/** A refused game action, sent to the device as `{ ok: false, error, message, field?, errors? }`. */
export class GameError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly field?: Field,
    readonly errors?: FieldErrors,
  ) {
    super(message)
  }
}

/** An HTTP error with a JSON body. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: { error: string; message: string; [k: string]: unknown },
  ) {
    super(body.message)
  }
}

export const httpError = (status: number, error: string, message: string, extra: Record<string, unknown> = {}) =>
  new HttpError(status, { error, message, ...extra })

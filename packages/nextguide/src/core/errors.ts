/**
 * Base class for every error thrown by NextGuide packages. Catch this to
 * handle any NextGuide failure, or check `code` for the specific case.
 */
export class NextGuideError extends Error {
  readonly code: string

  constructor(message: string, code = "NEXTGUIDE_ERROR", options?: { cause?: unknown }) {
    super(message, options)
    this.name = "NextGuideError"
    this.code = code
  }
}

/** True for errors thrown by NextGuide packages. */
export function isNextGuideError(error: unknown): error is NextGuideError {
  return error instanceof NextGuideError
}

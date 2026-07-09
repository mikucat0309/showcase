import type { Context } from 'hono'
import type { ErrorResponse } from '../types'

export function onValidationError(
  result: { success: true } | { success: false; error: { issues: { message: string }[] } },
  c: Context,
) {
  if (!result.success) {
    return c.json<ErrorResponse>({
      error: result.error.issues.map((i) => i.message).join('; '),
    }, 400)
  }
}

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ErrorResponse } from './types'
import objects from './routes/objects'
import uploads from './routes/uploads'

const app = new Hono()

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json<ErrorResponse>({ error: error.message }, error.status)
  }
  const message =
    error instanceof Error ? error.message : 'Unexpected server error'
  return c.json<ErrorResponse>({ error: message }, 500)
})

app.notFound((c) => {
  return c.json<ErrorResponse>({ error: 'Not found' }, 404)
})

app.route('/', objects)
app.route('/', uploads)

export default app

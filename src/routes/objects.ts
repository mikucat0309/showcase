import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { onValidationError } from './validation'
import {
  BucketParams,
  BucketKeyParams,
  ListObjectsQuerySchema,
  DownloadQuerySchema,
  BucketListResponse,
  ListObjectsResponse,
  DownloadResponse,
} from './types'
import { getS3Client, listBucketNames, sanitizeETag } from '../s3'

const objects = new Hono()

objects.get('/buckets', async (c) => {
  return c.json<BucketListResponse>({ buckets: listBucketNames() })
})

objects.get(
  '/buckets/:bucket/objects',
  zValidator('param', BucketParams, onValidationError),
  zValidator('query', ListObjectsQuerySchema, onValidationError),
  async (c) => {
    const { bucket } = c.req.valid('param')
    const { prefix, limit, cursor } = c.req.valid('query')
    const s3 = getS3Client(bucket)
    if (!s3) throw new HTTPException(404, { message: 'Bucket not found' })

    const result = await s3.listObjectsPaged(
      undefined,
      prefix,
      limit ?? 100,
      cursor,
    )

    if (!result) return c.json<ListObjectsResponse>({ items: [] })

    return c.json<ListObjectsResponse>({
      items: (result.objects ?? []).map((o) => ({
        key: o.Key,
        size: o.Size,
        lastModified: o.LastModified.toISOString(),
        etag: sanitizeETag(o.ETag),
      })),
      nextCursor: result.nextContinuationToken,
    })
  },
)

objects.get(
  '/buckets/:bucket/objects/:key',
  zValidator('param', BucketKeyParams, onValidationError),
  zValidator('query', DownloadQuerySchema, onValidationError),
  async (c) => {
    const { bucket, key } = c.req.valid('param')
    const query = c.req.valid('query')
    const s3 = getS3Client(bucket)
    if (!s3) throw new HTTPException(404, { message: 'Bucket not found' })

    if (query.expiresIn) {
      const url = await s3.getPresignedUrl('GET', key, query.expiresIn)
      return c.json<DownloadResponse>({ url, mode: 'presigned' })
    }

    const url = `${s3.endpoint}/${key}`
    return c.json<DownloadResponse>({ url, mode: 'direct' })
  },
)

objects.delete(
  '/buckets/:bucket/objects/:key',
  zValidator('param', BucketKeyParams, onValidationError),
  async (c) => {
    const { bucket, key } = c.req.valid('param')
    const s3 = getS3Client(bucket)
    if (!s3) throw new HTTPException(404, { message: 'Bucket not found' })

    await s3.deleteObject(key)
    return c.body(null, 204)
  },
)

export default objects

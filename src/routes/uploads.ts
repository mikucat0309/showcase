import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { onValidationError } from './validation'
import {
  BucketParams,
  UploadIdParams,
  CreateUploadRequestSchema,
  CompleteUploadRequestSchema,
  AbortUploadRequestSchema,
  CreateUploadResponse,
  CompleteUploadResponse,
} from './types'
import { getS3Client, sanitizeETag } from '../s3'

const MULTIPART_THRESHOLD_BYTES = 20 * 1024 * 1024
const DEFAULT_PART_SIZE = 5

const uploads = new Hono()

uploads.post(
  '/buckets/:bucket/uploads',
  zValidator('param', BucketParams, onValidationError),
  zValidator('json', CreateUploadRequestSchema, onValidationError),
  async (c) => {
    const { bucket } = c.req.valid('param')
    const body = c.req.valid('json')
    const s3 = getS3Client(bucket)
    if (!s3) throw new HTTPException(404, { message: 'Bucket not found' })

    const useMultipart =
      body.mode === 'multipart' ||
      (body.mode === undefined && body.size > MULTIPART_THRESHOLD_BYTES)

    if (!useMultipart) {
      const url = await s3.getPresignedUrl('PUT', body.key)
      return c.json<CreateUploadResponse>({ mode: 'simple', key: body.key, uploadId: null, url })
    }

    const partSize = (body.partSize ?? DEFAULT_PART_SIZE) * 1024 * 1024
    const uploadId = await s3.getMultipartUploadId(body.key, body.contentType)
    const partCount = Math.ceil(body.size / partSize)
    const parts = await Promise.all(
      Array.from({ length: partCount }, (_, i) => i + 1).map(
        async (partNumber) => ({
          partNumber,
          url: await s3.getPresignedUrl('PUT', body.key, 3600, {
            partNumber: String(partNumber),
            uploadId,
          }),
        }),
      ),
    )
    return c.json<CreateUploadResponse>({ mode: 'multipart', key: body.key, uploadId, partSize, parts })
  },
)

uploads.post(
  '/buckets/:bucket/uploads/:uploadId/complete',
  zValidator('param', UploadIdParams, onValidationError),
  zValidator('json', CompleteUploadRequestSchema, onValidationError),
  async (c) => {
    const { bucket, uploadId } = c.req.valid('param')
    const body = c.req.valid('json')
    const s3 = getS3Client(bucket)
    if (!s3) throw new HTTPException(404, { message: 'Bucket not found' })

    const parts = body.parts.map((p) => ({
      partNumber: p.partNumber,
      etag: sanitizeETag(p.etag),
    }))
    const result = await s3.completeMultipartUpload(body.key, uploadId, parts)
    return c.json<CompleteUploadResponse>({ key: body.key, etag: sanitizeETag(result.etag) })
  },
)

uploads.delete(
  '/buckets/:bucket/uploads/:uploadId',
  zValidator('param', UploadIdParams, onValidationError),
  zValidator('json', AbortUploadRequestSchema, onValidationError),
  async (c) => {
    const { bucket, uploadId } = c.req.valid('param')
    const body = c.req.valid('json')
    const s3 = getS3Client(bucket)
    if (!s3) throw new HTTPException(404, { message: 'Bucket not found' })

    await s3.abortMultipartUpload(body.key, uploadId)
    return c.body(null, 204)
  },
)

export default uploads

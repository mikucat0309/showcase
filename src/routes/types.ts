import { z } from 'zod'

export const BucketParams = z.object({ bucket: z.string().min(1) })
export const BucketKeyParams = z.object({
  bucket: z.string().min(1),
  key: z.string().min(1),
})
export const UploadIdParams = z.object({
  bucket: z.string().min(1),
  uploadId: z.string().min(1),
})

export const ListObjectsQuerySchema = z.object({
  prefix: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const DownloadQuerySchema = z.object({
  expiresIn: z.coerce.number().int().min(1).max(604800).optional(),
})

export const CompletedPartSchema = z.object({
  partNumber: z.number().int().positive(),
  etag: z.string().min(1),
})

export const CompleteUploadRequestSchema = z.object({
  key: z.string().min(1),
  parts: z.array(CompletedPartSchema).min(1),
})

export const AbortUploadRequestSchema = z.object({
  key: z.string().min(1),
})

export const CreateUploadRequestSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().positive(),
  partSize: z.number().int().min(5).max(100).optional(),
  mode: z.enum(['simple', 'multipart']).optional(),
})

export type ObjectInfo = {
  key: string
  size: number
  lastModified: string
  etag: string
}

export type ListObjectsResponse = {
  items: ObjectInfo[]
  nextCursor?: string
}

export type DownloadResponse = {
  url: string
  mode: 'direct' | 'presigned'
}

export type PresignedPart = {
  partNumber: number
  url: string
}

export type CreateUploadResponse =
  | { mode: 'simple'; key: string; uploadId: null; url: string }
  | {
      mode: 'multipart'
      key: string
      uploadId: string
      partSize: number
      parts: PresignedPart[]
    }

export type CompleteUploadResponse = {
  key: string
  etag: string
}

export type BucketListResponse = { buckets: string[] }

# API

S3 JSON API

## Conventions

- Error envelope: `{ "error": string }`
- Buckets: configured via `BUCKETS` env binding (JSON in `wrangler.jsonc`)

## List bucket

GET /buckets

Response 200:
```ts
{ buckets: Array<string> }
```

## List object

GET /buckets/<bucketName>/objects

Query:
- `prefix?: string`
- `cursor?: string`
- `limit?: number` (default 100)

Response 200:
```ts
{
  items: Array<{ key: string; size: number; lastModified: string; etag: string }>,
  nextCursor?: string
}
```

## Download object

GET /buckets/<bucketName>/objects/<key>

Query:
- `expiresIn?: number` (min 1, max 604800) — if set, returns a presigned URL; otherwise returns a direct URL

Response 200:
```ts
{
  url: string
  mode: 'direct' | 'presigned'
}
```

## Create simple / multipart upload

POST /buckets/<bucketName>/uploads

Request:
```ts
{
  key: string
  contentType: string
  size: number
  partSize?: number
  mode?: 'simple' | 'multipart'
}
```

if `mode` is set, use it, else if `size <= 20 MiB` → simple, else multipart.

Response 200 (simple):
```ts
{
  mode: 'simple',
  key: string,
  uploadId: null,
  url: string
}
```

Response 200 (multipart):
```ts
{
  mode: 'multipart'
  key: string
  uploadId: string
  partSize: number
  parts: Array<{ partNumber: number; url: string }>
}
```

## Complete multipart upload

POST /buckets/<bucketName>/uploads/<uploadID>/complete

Request:
```ts
{ key: string; parts: Array<{ partNumber: number; etag: string }> }
```

Response 200:
```ts
{ key: string; etag: string }
```

## Abort multipart upload

DELETE /buckets/<bucketName>/uploads/<uploadID>

Request body:
```ts
{ key: string }
```

Response: `204 No Content`

## Delete a object

DELETE /buckets/<bucketName>/objects/<key>

Response: `204 No Content`

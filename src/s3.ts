import { env } from 'cloudflare:workers'
import { S3mini } from 's3mini'

type BucketConfig = {
  name: string
  region: string
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
}

const bucketConfigs: BucketConfig[] = JSON.parse(env.BUCKETS)
const configs = new Map(bucketConfigs.map((b) => [b.name, b]))
const clients = new Map<string, S3mini>()

export function getS3Client(bucketName: string): S3mini | null {
  const cached = clients.get(bucketName)
  if (cached) return cached

  const config = configs.get(bucketName)
  if (!config) return null

  const client = new S3mini({
    endpoint: config.endpoint,
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  })

  clients.set(bucketName, client)
  return client
}

export function listBucketNames(): string[] {
  return bucketConfigs.map((b) => b.name)
}

export function sanitizeETag(etag: string): string {
  return etag.replace(/^"/, '').replace(/"$/, '')
}

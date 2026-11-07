import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireEnv } from './http.js'

const DEFAULT_ENDPOINT =
  'https://c1bb96e74762c8da2a13c9ef3b56d667.r2.cloudflarestorage.com/assets'

let client: S3Client | null = null
let resolvedBucket: string | null = null

function r2Target(): { endpoint: string; bucket: string } {
  const raw = process.env.R2_ENDPOINT || DEFAULT_ENDPOINT
  const url = new URL(raw)
  const pathBucket = url.pathname.split('/').filter(Boolean)[0]
  return {
    endpoint: url.origin,
    bucket: process.env.R2_BUCKET || pathBucket || 'assets',
  }
}

function r2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: r2Target().endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
      },
    })
  }
  return client
}

function bucket(): string {
  if (!resolvedBucket) resolvedBucket = r2Target().bucket
  return resolvedBucket
}

export function presignPut(key: string, contentType: string, contentLength: number): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn: 300 }
  )
}

export function presignGet(key: string, opts: { downloadName?: string } = {}): Promise<string> {
  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ...(opts.downloadName
        ? { ResponseContentDisposition: `attachment; filename="${opts.downloadName}"` }
        : {}),
    }),
    { expiresIn: 600 }
  )
}

export async function headObject(key: string): Promise<{ size?: number; type?: string } | null> {
  try {
    const head = await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
    return { size: head.ContentLength, type: head.ContentType }
  } catch {
    return null
  }
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
}

export async function deleteObject(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
}

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Phase 2 S3-compatible storage (works with AWS S3, Cloudflare
 * R2, or MinIO via S3_ENDPOINT + forcePathStyle).
 *
 * Env: S3_ENDPOINT, S3_BUCKET, S3_REGION (default us-east-1),
 * S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE
 * (default true, needed for R2/MinIO).
 *
 * If the bucket/credentials are not configured, every URL
 * method throws 503 STORAGE_NOT_CONFIGURED instead of
 * pretending an upload worked. That is the honest state
 * until a bucket exists — the API and UI surface the error
 * instead of faking a photo.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client | null;
  readonly bucket: string | null;

  constructor() {
    const bucket = process.env.S3_BUCKET ?? null;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? null;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? null;
    this.bucket = bucket;
    this.client =
      bucket && accessKeyId && secretAccessKey
        ? new S3Client({
            region: process.env.S3_REGION ?? 'us-east-1',
            endpoint: process.env.S3_ENDPOINT ?? undefined,
            forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  get configured(): boolean {
    return this.client !== null && this.bucket !== null;
  }

  private requireConfigured(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket) {
      throw new HttpException(
        { error: { code: 'STORAGE_NOT_CONFIGURED', message: 'Photo storage is not configured: set S3_BUCKET and S3 credentials' } },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { client: this.client, bucket: this.bucket };
  }

  async uploadUrl(key: string, contentType: string): Promise<string> {
    const { client, bucket } = this.requireConfigured();
    return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 600 });
  }

  async downloadUrl(key: string): Promise<string> {
    const { client, bucket } = this.requireConfigured();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    const { client, bucket } = this.requireConfigured();
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body: any = res.Body;
    if (body?.transformToByteArray) return Buffer.from(await body.transformToByteArray());
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
    const { client, bucket } = this.requireConfigured();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
  }
}

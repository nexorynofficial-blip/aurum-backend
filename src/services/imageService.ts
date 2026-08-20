import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3, publicAssetBase } from '../config/s3';
import { env } from '../config/env';
import { ApiError } from '../utils/apiError';

function client() {
  if (!s3) throw ApiError.serviceUnavailable('Image storage is not configured');
  return s3;
}

/** Upload a product image to S3 and return its public (CDN) URL. */
export async function uploadImageToS3(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `products/${Date.now()}-${safe}`;

  await client().send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    })
  );

  return `${publicAssetBase}/${key}`;
}

/** Presigned URL for temporary private access. */
export async function getSignedImageUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key });
  return getSignedUrl(client(), command, { expiresIn });
}

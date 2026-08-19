import { S3Client } from '@aws-sdk/client-s3';
import { env, features } from './env';
import { logger } from './logger';

/**
 * AWS S3 client for product-image storage. Null when credentials are absent
 * so the API still boots locally; image upload endpoints return 503.
 */
export const s3: S3Client | null = features.s3
  ? new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
      },
    })
  : null;

if (!features.s3) {
  logger.warn('AWS S3 not configured — image upload is disabled.');
}

/** Public base URL used to serve uploaded objects (CloudFront preferred). */
export const publicAssetBase =
  env.AWS_CLOUDFRONT_URL ||
  env.AWS_S3_URL ||
  (env.AWS_S3_BUCKET ? `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com` : '');

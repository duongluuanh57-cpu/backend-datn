/**
 * Storage Config — Cấu hình Cloudflare R2 (S3 Compatible)
 */
export const storageConfig = {
  endpoint: process.env.R2_ENDPOINT || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucketName: process.env.R2_BUCKET_NAME || 'elite-saas-assets',
  publicUrl: process.env.R2_PUBLIC_URL || 'https://assets.elite-saas.com',
};

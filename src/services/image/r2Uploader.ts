import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from './r2Client.ts';
import { ImageOptimizer } from './imageOptimizer.ts';

export interface ImgBBUploadResult {
  url: string;
  displayUrl: string;
  thumbUrl?: string;
  deleteUrl?: string;
  originalBytes: number;
  compressedBytes: number;
}

export class R2Uploader {
  /**
   * Nén ảnh bằng Sharp (WebP) rồi tải lên Cloudflare R2 S3-compatible.
   */
  static async compressAndUpload(
    inputBuffer: Buffer,
    options?: { maxWidth?: number; quality?: number; name?: string; folder?: string }
  ): Promise<ImgBBUploadResult> {
    const bucketName = process.env.R2_BUCKET_NAME || 'lessence-media';
    const publicDomain = process.env.R2_PUBLIC_DOMAIN;
    if (!publicDomain?.trim()) {
      throw new Error('Chưa cấu hình R2_PUBLIC_DOMAIN trong môi trường.');
    }

    const maxWidth = options?.maxWidth ?? 1920;
    const quality = options?.quality ?? 90;
    const originalBytes = inputBuffer.length;

    // Chuẩn hóa và xác thực thư mục R2 (products, brands, avatars, image)
    let folder = 'image';
    if (options?.folder) {
      const cleanFolder = options.folder.trim().toLowerCase().replace(/\/+$/, '');
      if (cleanFolder === 'products' || cleanFolder.startsWith('products/')) {
        folder = cleanFolder;
      } else if (cleanFolder === 'brands' || cleanFolder.startsWith('brands/')) {
        folder = cleanFolder;
      } else if (cleanFolder === 'avatars' || cleanFolder === 'avaters' || cleanFolder.startsWith('avatars/')) {
        folder = 'avatars';
      } else if (cleanFolder === 'image' || cleanFolder === 'images' || cleanFolder.startsWith('image/')) {
        folder = cleanFolder;
      }
    }

    const compressed = await ImageOptimizer.optimizeForWeb(inputBuffer, maxWidth, quality);
    const baseName = (options?.name || 'upload')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase() || 'upload';
    const hash = Math.random().toString(36).substring(2, 10);
    const fileName = `${folder}/${hash}-${baseName}.webp`;

    try {
      const client = getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileName,
          Body: compressed,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );

      const finalUrl = `${publicDomain.replace(/\/$/, '')}/${fileName}`;

      return {
        url: finalUrl,
        displayUrl: finalUrl,
        thumbUrl: finalUrl,
        originalBytes,
        compressedBytes: compressed.length
      };
    } catch (error) {
      console.error('[ImageService R2 Upload Error]', error);
      throw new Error(error instanceof Error ? error.message : 'Lỗi khi lưu trữ hình ảnh lên Cloudflare R2.');
    }
  }
}
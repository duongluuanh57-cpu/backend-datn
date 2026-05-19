import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Chưa cấu hình đầy đủ CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY trong môi trường.');
  }

  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3Client;
}

export interface ImgBBUploadResult {
  url: string;
  displayUrl: string;
  thumbUrl?: string;
  deleteUrl?: string;
  originalBytes: number;
  compressedBytes: number;
}

/**
 * ImageService — Xử lý và tối ưu hóa hình ảnh theo tiêu chuẩn Elite SaaS 2026
 */
export class ImageService {
  /**
   * Tối ưu hóa ảnh cho Web (Chuyển sang WebP, nén và resize)
   */
  static async optimizeForWeb(
    inputBuffer: Buffer,
    maxWidth: number = 1920,
    quality: number = 90
  ): Promise<Buffer> {
    try {
      return await sharp(inputBuffer)
        .resize({
          width: maxWidth,
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ quality }) // WebP giúp giảm ~50-80% dung lượng so với JPG/PNG
        .toBuffer();
    } catch (error) {
      console.error('[ImageService Optimize Error]', error);
      throw new Error('Không thể tối ưu hóa hình ảnh này.');
    }
  }

  /**
   * Tạo Thumbnail nhanh
   */
  static async generateThumbnail(inputBuffer: Buffer, size: number = 200): Promise<Buffer> {
    try {
      return await sharp(inputBuffer)
        .resize(size, size, {
          fit: 'cover'
        })
        .webp({ quality: 70 })
        .toBuffer();
    } catch (error) {
      console.error('[ImageService Thumbnail Error]', error);
      throw new Error('Không thể tạo ảnh thumbnail.');
    }
  }

  /**
   * Lấy thông tin Metadata của ảnh
   */
  static async getMetadata(inputBuffer: Buffer) {
    try {
      return await sharp(inputBuffer).metadata();
    } catch (error) {
      console.error('[ImageService Metadata Error]', error);
      throw new Error('Không thể đọc thông tin hình ảnh.');
    }
  }

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

    const compressed = await ImageService.optimizeForWeb(inputBuffer, maxWidth, quality);
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

  /**
   * Xóa ảnh khỏi Cloudflare R2 dựa trên URL công khai
   */
  static async deleteFromR2(url: string): Promise<boolean> {
    if (!url || typeof url !== 'string' || !url.trim()) return false;
    
    const publicDomain = process.env.R2_PUBLIC_DOMAIN;
    if (!publicDomain) {
      console.warn('[ImageService] R2_PUBLIC_DOMAIN chưa cấu hình, không thể tự động xóa ảnh.');
      return false;
    }

    const bucketName = process.env.R2_BUCKET_NAME || 'lessence-media';

    try {
      // Lấy phần đuôi (Key) từ URL
      let key = '';
      if (url.includes(publicDomain)) {
        key = url.split(publicDomain).pop()?.replace(/^\//, '') || '';
      } else if (url.includes('.r2.dev')) {
        const urlObj = new URL(url);
        key = urlObj.pathname.replace(/^\//, '');
      }

      if (!key) {
        console.log(`[ImageService] URL không thuộc Cloudflare R2, bỏ qua xóa: ${url}`);
        return false;
      }

      console.log(`[ImageService] Đang xóa file trên Cloudflare R2: Bucket=${bucketName}, Key=${key}`);
      
      const client = getS3Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        })
      );

      console.log(`[ImageService] Đã xóa file trên R2 thành công: ${key}`);
      return true;
    } catch (error) {
      console.error('[ImageService R2 Delete Error]', error);
      return false;
    }
  }
}

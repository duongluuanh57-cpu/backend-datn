import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

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
    quality: number = 80
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
   * Giả lập Upload lên Cloudflare R2 (Placeholder)
   */
  static async uploadToR2(buffer: Buffer, fileName: string): Promise<string> {
    // Trong thực tế, sẽ sử dụng AWS SDK (S3 Compatible) để upload lên R2
    // Ở đây chúng ta tạm thời lưu vào folder 'uploads' để minh họa
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      const finalPath = path.join(uploadDir, fileName);
      await fs.writeFile(finalPath, buffer);
      
      return `https://cdn.example.com/uploads/${fileName}`; // URL giả lập
    } catch (error) {
      console.error('[ImageService Upload Error]', error);
      throw new Error('Lỗi khi lưu trữ hình ảnh.');
    }
  }

  /**
   * Nén ảnh bằng Sharp (WebP) rồi tải lên ImgBB.
   * Cần biến môi trường IMGBB_API_KEY (lấy tại https://api.imgbb.com/).
   */
  static async compressAndUploadToImgBB(
    inputBuffer: Buffer,
    options?: { maxWidth?: number; quality?: number; name?: string }
  ): Promise<ImgBBUploadResult> {
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey?.trim()) {
      throw new Error('Chưa cấu hình IMGBB_API_KEY trong môi trường.');
    }

    const maxWidth = options?.maxWidth ?? 1920;
    const quality = options?.quality ?? 80;
    const originalBytes = inputBuffer.length;

    const compressed = await ImageService.optimizeForWeb(inputBuffer, maxWidth, quality);
    const baseName =
      (options?.name || 'upload').replace(/\.[^/.]+$/, '') || 'upload';

    const body = new URLSearchParams();
    body.set('key', apiKey.trim());
    body.set('image', compressed.toString('base64'));
    body.set('name', baseName);

    const res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body
    });

    const json = (await res.json()) as {
      success?: boolean;
      status?: number;
      error?: { message?: string };
      data?: {
        url?: string;
        display_url?: string;
        thumb?: { url?: string };
        delete_url?: string;
      };
    };

    if (!json.success || !json.data?.url || !json.data?.display_url) {
      const msg = json.error?.message || 'ImgBB từ chối hoặc phản hồi không hợp lệ.';
      throw new Error(msg);
    }

    return {
      url: json.data.url,
      displayUrl: json.data.display_url,
      thumbUrl: json.data.thumb?.url,
      deleteUrl: json.data.delete_url,
      originalBytes,
      compressedBytes: compressed.length
    };
  }
}

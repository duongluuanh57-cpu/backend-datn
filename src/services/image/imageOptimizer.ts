import sharp from 'sharp';

export class ImageOptimizer {
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
}
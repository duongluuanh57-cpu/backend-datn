import { ProductImage } from '../models/ProductImage.ts';
import type { IProductImage } from '../models/ProductImage.ts';
import mongoose from 'mongoose';
import { ImageService } from './ImageService.ts';

export class ProductImageService {
  /**
   * Lấy tất cả hình ảnh của một sản phẩm
   */
  static async getProductImages(
    productId: string,
    tenantId: string
  ): Promise<IProductImage[]> {
    return await ProductImage.find({
      productId: new mongoose.Types.ObjectId(productId),
      tenantId
    }).sort({ createdAt: -1 });
  }

  /**
   * Lấy hình ảnh chính (đầu tiên) của sản phẩm
   */
  static async getPrimaryImage(
    productId: string,
    tenantId: string
  ): Promise<IProductImage | null> {
    return await ProductImage.findOne({
      productId: new mongoose.Types.ObjectId(productId),
      tenantId
    }).sort({ createdAt: 1 }); // Lấy ảnh cũ nhất (ảnh đầu tiên được upload)
  }

  /**
   * Thêm hình ảnh mới cho sản phẩm
   */
  static async addProductImage(
    productId: string,
    url: string,
    tenantId: string
  ): Promise<IProductImage> {
    const productImage = new ProductImage({
      productId: new mongoose.Types.ObjectId(productId),
      url,
      tenantId
    });
    return await productImage.save();
  }

  /**
   * Thêm nhiều hình ảnh cho sản phẩm
   */
  static async addMultipleImages(
    productId: string,
    urls: string[],
    tenantId: string
  ): Promise<IProductImage[]> {
    const images = urls.map(url => ({
      productId: new mongoose.Types.ObjectId(productId),
      url,
      tenantId
    }));
    return await ProductImage.insertMany(images);
  }

  /**
   * Xóa một hình ảnh
   */
  static async deleteProductImage(
    imageId: string,
    tenantId: string
  ): Promise<boolean> {
    const image = await ProductImage.findOne({ _id: imageId, tenantId });
    if (!image) return false;

    const result = await ProductImage.deleteOne({ _id: imageId, tenantId });
    
    if (result.deletedCount > 0) {
      // Xóa file khỏi R2
      ImageService.deleteFromR2(image.url).catch(err => {
        console.error('Lỗi khi xóa ảnh khỏi R2:', err);
      });
    }

    return result.deletedCount > 0;
  }

  /**
   * Xóa tất cả hình ảnh của một sản phẩm
   */
  static async deleteAllProductImages(
    productId: string,
    tenantId: string
  ): Promise<number> {
    const images = await ProductImage.find({
      productId: new mongoose.Types.ObjectId(productId),
      tenantId
    });

    const result = await ProductImage.deleteMany({
      productId: new mongoose.Types.ObjectId(productId),
      tenantId
    });

    // Xóa tất cả files khỏi R2
    if (result.deletedCount > 0) {
      const foldersToDelete = new Set<string>();
      for (const image of images) {
        ImageService.deleteFromR2(image.url).catch(err => {
          console.error('Lỗi khi xóa ảnh khỏi R2:', err);
        });
        const folder = ImageService.getFolderFromUrl(image.url);
        if (folder) {
          foldersToDelete.add(folder);
        }
      }
      for (const folder of foldersToDelete) {
        ImageService.deleteFolderFromR2(folder).catch(err => {
          console.error('Lỗi khi xóa folder trên R2:', err);
        });
      }
    }

    return result.deletedCount;
  }

  /**
   * Xóa tất cả hình ảnh của nhiều sản phẩm
   */
  static async bulkDeleteProductImages(
    productIds: string[],
    tenantId: string
  ): Promise<number> {
    const objectIds = productIds.map(id => new mongoose.Types.ObjectId(id));
    const images = await ProductImage.find({
      productId: { $in: objectIds },
      tenantId
    });

    const result = await ProductImage.deleteMany({
      productId: { $in: objectIds },
      tenantId
    });

    // Xóa tất cả files khỏi R2
    if (result.deletedCount > 0) {
      const foldersToDelete = new Set<string>();
      for (const image of images) {
        ImageService.deleteFromR2(image.url).catch(err => {
          console.error('Lỗi khi xóa ảnh khỏi R2 trong bulk delete:', err);
        });
        const folder = ImageService.getFolderFromUrl(image.url);
        if (folder) {
          foldersToDelete.add(folder);
        }
      }
      for (const folder of foldersToDelete) {
        ImageService.deleteFolderFromR2(folder).catch(err => {
          console.error('Lỗi khi xóa folder trên R2 trong bulk delete:', err);
        });
      }
    }

    return result.deletedCount;
  }

  /**
   * Cập nhật URL của hình ảnh
   */
  static async updateImageUrl(
    imageId: string,
    newUrl: string,
    tenantId: string
  ): Promise<IProductImage | null> {
    const oldImage = await ProductImage.findOne({ _id: imageId, tenantId });
    if (!oldImage) return null;

    const oldUrl = oldImage.url;
    const updatedImage = await ProductImage.findOneAndUpdate(
      { _id: imageId, tenantId },
      { $set: { url: newUrl } },
      { new: true }
    );

    // Xóa ảnh cũ khỏi R2
    if (updatedImage && oldUrl !== newUrl) {
      ImageService.deleteFromR2(oldUrl).catch(err => {
        console.error('Lỗi khi xóa ảnh cũ khỏi R2:', err);
      });
    }

    return updatedImage;
  }

  /**
   * Lấy số lượng hình ảnh của một sản phẩm
   */
  static async getImageCount(
    productId: string,
    tenantId: string
  ): Promise<number> {
    return await ProductImage.countDocuments({
      productId: new mongoose.Types.ObjectId(productId),
      tenantId
    });
  }

  /**
   * Lấy hình ảnh của nhiều sản phẩm (bulk)
   * Trả về Map: productId -> images[]
   */
  static async getBulkProductImages(
    productIds: string[],
    tenantId: string
  ): Promise<Map<string, IProductImage[]>> {
    const objectIds = productIds.map(id => new mongoose.Types.ObjectId(id));
    
    const images = await ProductImage.find({
      productId: { $in: objectIds },
      tenantId
    }).sort({ createdAt: 1 });

    // Group images by productId
    const imageMap = new Map<string, IProductImage[]>();
    
    for (const image of images) {
      const productId = image.productId.toString();
      if (!imageMap.has(productId)) {
        imageMap.set(productId, []);
      }
      imageMap.get(productId)!.push(image);
    }

    return imageMap;
  }

  /**
   * Lấy hình ảnh chính của nhiều sản phẩm (bulk)
   * Trả về Map: productId -> primary image
   */
  static async getBulkPrimaryImages(
    productIds: string[],
    tenantId: string
  ): Promise<Map<string, IProductImage>> {
    const imageMap = await this.getBulkProductImages(productIds, tenantId);
    const primaryMap = new Map<string, IProductImage>();

    for (const [productId, images] of imageMap.entries()) {
      if (images.length > 0) {
        primaryMap.set(productId, images[0]); // Ảnh đầu tiên là ảnh chính
      }
    }

    return primaryMap;
  }
}

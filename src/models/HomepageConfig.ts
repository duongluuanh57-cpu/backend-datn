import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface ISectionConfig {
  id: string;
  enabled: boolean;
  order: number;
}

export interface IProductCardConfig {
  imageAspect: 'square' | 'portrait' | 'landscape';
  imagePadding: number;
  cardRadius: number;
  tagBgColor: string;
  tagTextColor: string;
  discountBadgeBg: string;
  discountBadgeText: string;
  brandFontSize: number;
  nameFontSize: number;
  priceFontSize: number;
  textAlign: 'center' | 'left';
  elementOrder: string[];
  showKeywords: boolean;
  showSizes: boolean;
  showRating: boolean;
}

export interface IGalleryImage {
  url: string;
  aspect: string;
  title: string;
  quote: string;
}

export interface IHomepageConfig extends Document {
  tenantId: string;
  sections: ISectionConfig[];
  bannerImages: string[];
  bannerTitleVi: string;
  bannerSubtitleVi: string;
  bannerLabelVi: string;
  bannerTitleEn: string;
  bannerSubtitleEn: string;
  bannerLabelEn: string;
  galleryVi: IGalleryImage[];
  galleryEn: IGalleryImage[];
  productCardConfig: IProductCardConfig;
  updatedAt: Date;
}

const SectionConfigSchema = new Schema<ISectionConfig>(
  {
    id: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    order: { type: Number, required: true }
  },
  { _id: false }
);

const GalleryImageSchema = new Schema<IGalleryImage>(
  {
    url: { type: String, default: '' },
    aspect: { type: String, default: 'aspect-[3/4]' },
    title: { type: String, default: '' },
    quote: { type: String, default: '' }
  },
  { _id: false }
);

const DEFAULT_SECTIONS: ISectionConfig[] = [
  { id: 'banner', enabled: true, order: 0 },
  { id: 'brandsMarquee', enabled: true, order: 1 },
  { id: 'saleProducts', enabled: true, order: 2 },
  { id: 'newProducts', enabled: true, order: 3 },
  { id: 'brandUsp', enabled: true, order: 4 },
  { id: 'luxuryGallery', enabled: true, order: 5 },
  { id: 'blogPosts', enabled: true, order: 6 }
];

const ProductCardConfigSchema = new Schema<IProductCardConfig>(
  {
    imageAspect: { type: String, enum: ['square', 'portrait', 'landscape'], default: 'square' },
    imagePadding: { type: Number, default: 40 },
    cardRadius: { type: Number, default: 16 },
    tagBgColor: { type: String, default: '#FFFFFF' },
    tagTextColor: { type: String, default: '#7A5C5C' },
    discountBadgeBg: { type: String, default: '#D4A5A5' },
    discountBadgeText: { type: String, default: '#FFFFFF' },
    brandFontSize: { type: Number, default: 11 },
    nameFontSize: { type: Number, default: 14 },
    priceFontSize: { type: Number, default: 16 },
    textAlign: { type: String, enum: ['center', 'left'], default: 'center' },
    elementOrder: {
      type: [String],
      default: ['keywords', 'brand', 'name', 'sizes', 'rating', 'price']
    },
    showKeywords: { type: Boolean, default: true },
    showSizes: { type: Boolean, default: true },
    showRating: { type: Boolean, default: true }
  },
  { _id: false }
);

const HomepageConfigSchema = new Schema<IHomepageConfig>(
  {
    sections: {
      type: [SectionConfigSchema],
      default: DEFAULT_SECTIONS
    },
    bannerImages: {
      type: [String],
      default: [
        '/images/banner-1.webp',
        '/images/banner-2.webp',
        '/images/banner-3.webp',
        '/images/banner-4.webp'
      ]
    },
    bannerTitleVi: { type: String, default: 'Độc bản hương thơm Niche' },
    bannerSubtitleVi: {
      type: String,
      default:
        'Khám phá tinh hoa mùi hương quý tộc mang đậm phong vị cá nhân từ những nhà điều chế hàng đầu thế giới.'
    },
    bannerLabelVi: { type: String, default: 'BST NƯỚC HOA CAO CẤP' },
    bannerTitleEn: { type: String, default: 'Bespoke Niche Perfumery' },
    bannerSubtitleEn: {
      type: String,
      default:
        'Explore the elite essence of royal perfumery, crafted for individual distinction by master scent designers.'
    },
    bannerLabelEn: { type: String, default: 'PREMIUM FRAGRANCE HOUSE' },
    galleryVi: { type: [GalleryImageSchema], default: [] },
    galleryEn: { type: [GalleryImageSchema], default: [] },
    productCardConfig: { type: ProductCardConfigSchema, default: () => ({}) }
  },
  {
    timestamps: true,
    collection: 'homepage_configs'
  }
);

HomepageConfigSchema.plugin(multiTenancyPlugin);

export const HomepageConfig =
  mongoose.models.HomepageConfig ||
  mongoose.model<IHomepageConfig>('HomepageConfig', HomepageConfigSchema);
